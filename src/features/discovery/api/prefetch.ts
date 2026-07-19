import type { QueryClient } from "@tanstack/react-query";
import { resolveDataMode } from "@/features/session";
import { getMockDiscover, getMockMe, getMockProfile } from "@/features/demo";
import type { SocialDiscoverData, SocialMeData, SocialProfileData } from "@/shared/types";
import {
  discoverQueryOptions,
  meQueryOptions,
  profileQueryOptions,
} from "./queries";
import { getDiscover, getMe } from "./discovery.functions";
import { getProfile } from "@/features/social";

/**
 * @responsibility Prefetch discover grid data for route loaders.
 * @sideEffects Populates React Query cache
 */
export async function prefetchDiscover(queryClient: QueryClient) {
  const mode = resolveDataMode();
  return queryClient.ensureQueryData(
    discoverQueryOptions(mode, () =>
      mode === "demo"
        ? Promise.resolve(getMockDiscover())
        : (getDiscover() as Promise<SocialDiscoverData>),
    ),
  );
}

/**
 * @responsibility Prefetch signed-in me payload for route loaders.
 * @sideEffects Populates React Query cache
 */
export async function prefetchMe(queryClient: QueryClient) {
  const mode = resolveDataMode();
  return queryClient.ensureQueryData(
    meQueryOptions(mode, () =>
      mode === "demo" ? Promise.resolve(getMockMe()) : (getMe() as Promise<SocialMeData>),
    ),
  );
}

/**
 * @responsibility Prefetch a public profile (+ me) for the profile route loader.
 * @sideEffects Populates React Query cache for profile and me keys
 */
export async function prefetchProfile(queryClient: QueryClient, username: string) {
  const mode = resolveDataMode();
  await Promise.all([
    queryClient.ensureQueryData(
      profileQueryOptions(username, mode, () =>
        mode === "demo"
          ? Promise.resolve(getMockProfile(username))
          : (getProfile({ data: { username } }) as Promise<SocialProfileData>),
      ),
    ),
    prefetchMe(queryClient),
  ]);
}
