/**
 * Account / creator / experience / privacy preference sections for Settings.
 *
 * Exports: SettingsPreferenceSections
 * Depends on: SettingsControls, preferences types, lucide icons, sonner
 */

import { useNavigate } from "@tanstack/react-router";
import {
  AtSign,
  Bell,
  Download,
  Edit3,
  EyeOff,
  Gauge,
  Globe2,
  HelpCircle,
  Info,
  Image as ImageIcon,
  Lock,
  MessageCircleOff,
  MoonStar,
  Palette,
  Shield,
  Sparkles,
  Type,
  UserCircle,
  Video,
} from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { toast } from "sonner";
import type { Preferences } from "../lib/preferences";
import {
  ControlRow,
  PreferenceRow,
  Row,
  Section,
  SegmentedControl,
} from "./SettingsControls";

type SettingsPreferenceSectionsProps = {
  prefs: Preferences;
  setPrefs: Dispatch<SetStateAction<Preferences>>;
  username: string | undefined;
  completion: number;
};

/**
 * Render the four preference section groups on Settings.
 * @param props.prefs - Current preference values
 * @param props.setPrefs - Preference state updater
 * @param props.username - Signed-in username when available
 * @param props.completion - Profile completion percent for the edit-profile row
 * @returns Fragment of preference sections
 */
export function SettingsPreferenceSections({
  prefs,
  setPrefs,
  username,
  completion,
}: SettingsPreferenceSectionsProps): ReactElement {
  const navigate = useNavigate();

  return (
    <>
      <Section title="account">
        <Row icon={<Edit3 />} label="edit profile" to="/edit-profile" value={`${completion}%`} />
        {username && (
          <Row
            icon={<AtSign />}
            label="public profile"
            value={`@${username}`}
            onClick={() => navigate({ to: "/u/$username", params: { username } })}
          />
        )}
        <PreferenceRow
          icon={<Lock />}
          label="private account"
          checked={prefs.privateAccount}
          onCheckedChange={(privateAccount) => setPrefs((p) => ({ ...p, privateAccount }))}
        />
        <ControlRow icon={<Globe2 />} label="default audience">
          <SegmentedControl
            value={prefs.audience}
            onChange={(audience) =>
              setPrefs((p) => ({ ...p, audience: audience as Preferences["audience"] }))
            }
            options={[
              { value: "public", label: "public" },
              { value: "followers", label: "followers" },
              { value: "private", label: "private" },
            ]}
          />
        </ControlRow>
      </Section>

      <Section title="creator defaults">
        <ControlRow icon={<Type />} label="post format">
          <SegmentedControl
            value={prefs.defaultFormat}
            onChange={(defaultFormat) =>
              setPrefs((p) => ({
                ...p,
                defaultFormat: defaultFormat as Preferences["defaultFormat"],
              }))
            }
            options={[
              { value: "text", label: "text", icon: <Type className="size-3" /> },
              { value: "image", label: "image", icon: <ImageIcon className="size-3" /> },
              { value: "video", label: "video", icon: <Video className="size-3" /> },
            ]}
          />
        </ControlRow>
        <PreferenceRow
          icon={<Sparkles />}
          label="reaction hints"
          checked={prefs.reactionHints}
          onCheckedChange={(reactionHints) => setPrefs((p) => ({ ...p, reactionHints }))}
        />
        <PreferenceRow
          icon={<Gauge />}
          label="autoplay previews"
          checked={prefs.autoplayPreviews}
          onCheckedChange={(autoplayPreviews) => setPrefs((p) => ({ ...p, autoplayPreviews }))}
        />
        <PreferenceRow
          icon={<EyeOff />}
          label="data saver"
          checked={prefs.dataSaver}
          onCheckedChange={(dataSaver) => setPrefs((p) => ({ ...p, dataSaver }))}
        />
      </Section>

      <Section title="experience">
        <PreferenceRow
          icon={<Bell />}
          label="push notifications"
          checked={prefs.pushOn}
          onCheckedChange={(pushOn) => setPrefs((p) => ({ ...p, pushOn }))}
        />
        <PreferenceRow
          icon={<MessageCircleOff />}
          label="comment filter"
          checked={prefs.commentFilter}
          onCheckedChange={(commentFilter) => setPrefs((p) => ({ ...p, commentFilter }))}
        />
        <PreferenceRow
          icon={<MoonStar />}
          label="reduced motion"
          checked={prefs.reducedMotion}
          onCheckedChange={(reducedMotion) => setPrefs((p) => ({ ...p, reducedMotion }))}
        />
        <Row
          icon={<Palette />}
          label="appearance"
          value="dark"
          onClick={() => toast("dark mode active")}
        />
      </Section>

      <Section title="privacy & support">
        <PreferenceRow
          icon={<Shield />}
          label="weekly digest"
          checked={prefs.weeklyDigest}
          onCheckedChange={(weeklyDigest) => setPrefs((p) => ({ ...p, weeklyDigest }))}
        />
        <Row
          icon={<UserCircle />}
          label="blocked accounts"
          value="0"
          onClick={() => toast("no blocked accounts")}
        />
        <Row
          icon={<Download />}
          label="download archive"
          onClick={() => toast("archive request queued")}
        />
        <Row icon={<Info />} label="about kinetic" to="/about" />
        <Row
          icon={<HelpCircle />}
          label="help & feedback"
          onClick={() => {
            window.location.href = "mailto:hello@kinetic.app";
          }}
        />
      </Section>
    </>
  );
}
