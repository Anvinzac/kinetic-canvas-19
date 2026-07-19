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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0014" },
      { title: "Long lanh" },
      { name: "description", content: "Thêm xíu năng lượng cho câu chữ nè" },
      { property: "og:title", content: "Long lanh" },
      { property: "og:description", content: "Thêm xíu năng lượng cho câu chữ nè" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Long lanh" },
      { name: "twitter:description", content: "Thêm xíu năng lượng cho câu chữ nè" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/48c8c6cc-2bcd-4632-9ca9-af6bf0155e74/id-preview-97829ef5--3adaf7f2-6c4c-403a-8f08-06ccb4e95507.lovable.app-1781719307239.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/48c8c6cc-2bcd-4632-9ca9-af6bf0155e74/id-preview-97829ef5--3adaf7f2-6c4c-403a-8f08-06ccb4e95507.lovable.app-1781719307239.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Space+Grotesk:wght@400;500;700&family=Bebas+Neue&family=Playfair+Display:ital,wght@0,400;0,700;1,700&family=JetBrains+Mono:wght@400;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <RootApp queryClient={queryClient} />;
}
