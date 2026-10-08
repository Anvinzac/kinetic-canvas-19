/**
 * Bottom drawer listing the other Chay Lá apps, as a tappable grid.
 *
 * Each tile is a plain anchor rather than a router Link: these are separate
 * deployments on sibling subdomains, so they are full navigations, not routes.
 *
 * Exports: EcosystemDrawer
 * Depends on: ui/drawer (vaul), ecosystem app data, ecosystem.css
 */

import type React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ECOSYSTEM_APPS, type EcosystemApp } from "../data/apps";
import "../ecosystem.css";

type EcosystemDrawerProps = {
  /** The control that opens the drawer; rendered as the trigger. */
  children: React.ReactNode;
};

function Tile({ app }: { app: EcosystemApp }): React.ReactElement {
  const content = (
    <>
      <span
        className="eco-tile-glyph"
        style={{ "--eco-from": app.accent[0], "--eco-to": app.accent[1] } as React.CSSProperties}
        aria-hidden="true"
      >
        {app.glyph}
      </span>
      <span className="eco-tile-body">
        <span className="eco-tile-name">{app.name}</span>
        <span className="eco-tile-tagline">{app.tagline}</span>
        {app.status === "soon" && <span className="eco-tile-soon">Sắp có</span>}
      </span>
    </>
  );

  if (app.status === "soon") {
    return (
      <li>
        <div className="eco-tile" data-soon aria-disabled="true">
          {content}
        </div>
      </li>
    );
  }

  return (
    <li>
      {/* noreferrer as well as noopener: these are sibling subdomains, and the
          referrer would leak which word the reader was on. */}
      <a
        className="eco-tile"
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${app.name} — ${app.tagline}`}
      >
        {content}
      </a>
    </li>
  );
}

/**
 * Drawer of sibling apps in the Chay Lá family.
 * @param children The trigger control to render.
 * @returns The trigger plus its drawer.
 */
export function EcosystemDrawer({ children }: EcosystemDrawerProps): React.ReactElement {
  return (
    <Drawer>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="eco-sheet-shell border-white/10 bg-[#120d22]/95">
        <div className="eco-sheet">
          <div className="eco-sheet-head">
            <DrawerTitle className="eco-sheet-title">Hệ sinh thái Chay Lá</DrawerTitle>
            <DrawerDescription className="eco-sheet-sub">
              Chạm để mở app khác trong nhà Chay Lá
            </DrawerDescription>
          </div>
          <ul className="eco-grid">
            {ECOSYSTEM_APPS.map((app) => (
              <Tile key={app.id} app={app} />
            ))}
          </ul>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
