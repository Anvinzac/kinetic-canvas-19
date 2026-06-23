-- Seed shared demo auth user matching the existing demo_creator profile.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000000',
  'authenticated', 'authenticated',
  'demo@kinetic.local',
  crypt('demo-kinetic-shared-2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Demo Creator","name":"Demo Creator"}'::jsonb,
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO UPDATE
  SET encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      updated_at = now();

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000000',
  jsonb_build_object('sub','00000000-0000-4000-8000-000000000000','email','demo@kinetic.local','email_verified', true),
  'email',
  '00000000-0000-4000-8000-000000000000',
  now(), now(), now()
)
ON CONFLICT (provider, provider_id) DO NOTHING;