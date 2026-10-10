/**
 * App root route: head meta, shell wiring, and document providers.
 *
 * Exports: Route
 * Depends on: @tanstack/react-query, @tanstack/react-router, features/shell, styles.css
 */

import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { ErrorComponent } from "@/features/shell/components/ErrorComponent";
import { NotFoundComponent } from "@/features/shell/components/NotFoundComponent";
import { RootApp, RootShell } from "@/features/shell/components/RootDocument";
import appCss from "../styles.css?url";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { resolveTarget, siteTitle } from "@/features/vocabulary/lib/target-language";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // The visited address picks the answer language (hoa.* → Chinese, etc.).
  loader: async () => ({
    locale: typeof window === "undefined" ? await getSiteLocale() : resolveTarget(window.location.host),
  }),
  head: ({ loaderData }) => {
    const title = siteTitle(loaderData?.locale ?? "en");
    return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0014" },
      { title },
      { name: "description", content: "Thêm xíu năng lượng cho câu chữ nè" },
      { property: "og:title", content: title },
      { property: "og:description", content: "Thêm xíu năng lượng cho câu chữ nè" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: "Thêm xíu năng lượng cho câu chữ nè" },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/48c8c6cc-2bcd-4632-9ca9-af6bf0155e74/id-preview-97829ef5--3adaf7f2-6c4c-403a-8f08-06ccb4e95507.lovable.app-1781719307239.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/48c8c6cc-2bcd-4632-9ca9-af6bf0155e74/id-preview-97829ef5--3adaf7f2-6c4c-403a-8f08-06ccb4e95507.lovable.app-1781719307239.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      // Weight RANGES, not a list of static cuts: the canvas paints body text at 800
      // and emphasis at 900, and with only 700/900 on offer both resolved to the same
      // face (or to a lighter one), so emphasis carried no weight contrast. A range is
      // also one variable file per subset instead of one per weight.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400..900&family=Space+Grotesk:wght@400..700&family=Playfair+Display:ital,wght@0,400..900;1,700&family=JetBrains+Mono:wght@400..800&family=Dancing+Script:wght@400..700&family=Playpen+Sans:wght@400..800&family=Shantell+Sans:wght@400..800&family=Charm:wght@400;700&display=swap",
      },
    ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <RootApp queryClient={queryClient} />;
}
