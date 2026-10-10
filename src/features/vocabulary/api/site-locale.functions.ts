/** Server fn: the answer language for the requested address. Exports: getSiteLocale. */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveTarget, type TargetLocale } from "../lib/target-language";

export const getSiteLocale = createServerFn({ method: "GET" }).handler((): TargetLocale => {
  const request = getRequest();
  return resolveTarget(request.headers.get("host") ?? new URL(request.url).host);
});
