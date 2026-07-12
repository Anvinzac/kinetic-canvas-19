// One-off bootstrap: creates the "system-bot" auth user + profile used by
// GitHub Actions to post content on behalf of automation. Idempotent — safe
// to call more than once; will not overwrite a rotated password.
import { createFileRoute } from '@tanstack/react-router';

const SYSTEM_EMAIL = 'system-bot@chayla.app';
const SYSTEM_PASSWORD = 'SysBot!Chayla-2026-Demo-A7k9Xp2Q';
const SYSTEM_USERNAME = 'system';

export const Route = createFileRoute('/api/public/bootstrap-system')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

        // 1. Look up (or create) the auth user.
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) return Response.json({ ok: false, step: 'listUsers', error: listErr.message }, { status: 500 });

        let userId = list.users.find((u) => u.email === SYSTEM_EMAIL)?.id;
        let created = false;
        if (!userId) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: SYSTEM_EMAIL,
            password: SYSTEM_PASSWORD,
            email_confirm: true,
            user_metadata: { system: true },
          });
          if (error || !data.user) {
            return Response.json({ ok: false, step: 'createUser', error: error?.message }, { status: 500 });
          }
          userId = data.user.id;
          created = true;
        }

        // 2. Upsert the profile and mark it is_system.
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (!existingProfile) {
          const { error: insErr } = await supabaseAdmin.from('profiles').insert({
            auth_user_id: userId,
            username: SYSTEM_USERNAME,
            display_name: 'System Bot',
            bio: 'Automated content pipeline',
            is_system: true,
          });
          if (insErr) return Response.json({ ok: false, step: 'insertProfile', error: insErr.message }, { status: 500 });
        } else {
          const { error: updErr } = await supabaseAdmin
            .from('profiles')
            .update({ is_system: true })
            .eq('id', existingProfile.id);
          if (updErr) return Response.json({ ok: false, step: 'updateProfile', error: updErr.message }, { status: 500 });
        }

        return Response.json({
          ok: true,
          created,
          userId,
          email: SYSTEM_EMAIL,
          username: SYSTEM_USERNAME,
        });
      },
    },
  },
});
