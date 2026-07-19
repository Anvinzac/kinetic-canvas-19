/**
 * Edit-profile form fields: display name, bio starters, and avatar URL.
 *
 * Exports: EditProfileFormFields, EditProfileField, isValidAvatarUrl
 * Depends on: lucide-react
 */

import { Link2, Wand2 } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

const BIO_STARTERS = [
  "kinetic typography and fast ideas",
  "posting motion sketches in public",
  "words, rhythm, loops, repeat",
  "building a tiny archive of moving thoughts",
];

type EditProfileFormFieldsProps = {
  displayName: string;
  bio: string;
  avatar: string;
  validAvatar: boolean;
  avatarError: boolean;
  username: string | undefined;
  onDisplayNameChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
};

/**
 * Render the editable form fields for display name, bio, and avatar URL.
 * @param props - Field values, validity, and change handlers
 * @returns Form field stack
 */
export function EditProfileFormFields({
  displayName,
  bio,
  avatar,
  validAvatar,
  avatarError,
  username,
  onDisplayNameChange,
  onBioChange,
  onAvatarChange,
}: EditProfileFormFieldsProps): ReactElement {
  return (
    <>
      <EditProfileField label="display name" hint={`${displayName.length}/60`}>
        <input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value.slice(0, 60))}
          className="w-full bg-transparent text-base font-display font-bold outline-none"
        />
      </EditProfileField>

      <EditProfileField label="bio" hint={`${bio.length}/280`}>
        <textarea
          value={bio}
          onChange={(e) => onBioChange(e.target.value.slice(0, 280))}
          rows={4}
          placeholder="what kinetic energy do you bring?"
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </EditProfileField>

      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <Wand2 className="size-3" />
          bio starters
        </div>
        <div className="flex flex-wrap gap-2">
          {BIO_STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => onBioChange(starter.slice(0, 280))}
              className="rounded-full bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 transition hover:ring-primary/60"
            >
              {starter}
            </button>
          ))}
        </div>
      </div>

      <EditProfileField
        label="avatar url"
        hint={validAvatar ? "https" : "invalid"}
        invalid={!validAvatar || avatarError}
        icon={<Link2 className="size-3" />}
      >
        <input
          value={avatar}
          onChange={(e) => onAvatarChange(e.target.value)}
          placeholder="https://"
          className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
      </EditProfileField>

      {username && (
        <p className="font-mono text-[10px] text-muted-foreground">
          handle: @{username} <span className="opacity-60">· permanent</span>
        </p>
      )}
    </>
  );
}

/**
 * Labeled input shell used by edit-profile fields.
 * @param props - Label, optional hint/icon/invalid styling, and input children
 * @returns Field label wrapper
 */
export function EditProfileField({
  label,
  hint,
  icon,
  invalid,
  children,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  invalid?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <label
      className={`block rounded-2xl bg-white/5 px-4 py-3 ring-1 transition focus-within:ring-primary/60 ${
        invalid ? "ring-destructive/70" : "ring-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {icon}
          {label}
        </span>
        {hint && (
          <span
            className={`font-mono text-[10px] ${invalid ? "text-destructive" : "text-muted-foreground/60"}`}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/**
 * Validate that a string is an http(s) URL.
 * @param value - Candidate URL string
 * @returns true when the URL parses with http or https protocol
 */
export function isValidAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
