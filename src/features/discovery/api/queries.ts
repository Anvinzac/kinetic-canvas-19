import { queryOptions } from "@tanstack/react-query";
import type { DataMode } from "@/features/session";
import {
  getMockDiscover,
  getMockMe,
  getMockNotifications,
  getMockProfile,
  searchMock,
} from "@/lib/mock-data";
import type {
  SocialDiscoverData,
  SocialMeData,
  SocialNotificationsData,
  SocialProfileData,
  SocialSearchData,
} from "@/shared/types";
import { discoveryKeys } from "./keys";

/**
 * @responsibility Build discover-grid query options (demo or live).
 * @pure true — factory only
 */
export function discoverQueryOptions(
  mode: DataMode,
  fetchLive: () => Promise<SocialDiscoverData>,
) {
  return queryOptions({
    queryKey: discoveryKeys.discover(mode),
    queryFn: (): Promise<SocialDiscoverData> =>
      mode === "demo" ? Promise.resolve(getMockDiscover()) : fetchLive(),
    staleTime: 30_000,
  });
}

/**
 * @responsibility Build search query options; disabled when q is empty at call site.
 * @pure true — factory only
 */
export function searchQueryOptions(
  mode: DataMode,
  q: string,
  fetchLive: () => Promise<SocialSearchData>,
) {
  return queryOptions({
    queryKey: discoveryKeys.search(mode, q),
    queryFn: (): Promise<SocialSearchData> =>
      mode === "demo" ? Promise.resolve(searchMock(q)) : fetchLive(),
    enabled: q.length > 0,
  });
}

/**
 * @responsibility Build notifications query options.
 * @pure true — factory only
 */
export function notificationsQueryOptions(
  mode: DataMode,
  fetchLive: () => Promise<SocialNotificationsData>,
) {
  return queryOptions({
    queryKey: discoveryKeys.notifications(mode),
    queryFn: (): Promise<SocialNotificationsData> =>
      mode === "demo" ? Promise.resolve(getMockNotifications()) : fetchLive(),
    staleTime: 15_000,
  });
}

/**
 * @responsibility Build signed-in "me" query options.
 * @pure true — factory only
 */
export function meQueryOptions(mode: DataMode, fetchLive: () => Promise<SocialMeData>) {
  return queryOptions({
    queryKey: discoveryKeys.me(mode),
    queryFn: (): Promise<SocialMeData> =>
      mode === "demo" ? Promise.resolve(getMockMe()) : fetchLive(),
  });
}

/**
 * @responsibility Build public profile query options by username.
 * @pure true — factory only
 */
export function profileQueryOptions(
  username: string,
  mode: DataMode,
  fetchLive: () => Promise<SocialProfileData>,
) {
  return queryOptions({
    queryKey: discoveryKeys.profile(username, mode),
    queryFn: (): Promise<SocialProfileData> =>
      mode === "demo" ? Promise.resolve(getMockProfile(username)) : fetchLive(),
  });
}
