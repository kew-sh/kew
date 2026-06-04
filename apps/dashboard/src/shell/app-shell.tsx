import { Suspense, useState } from "react";
import { CommandMenu } from "@/components/command-menu";
import { ConnectionBanner } from "./connection-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only z-100 rounded-md bg-accent-strong px-3 py-2 text-sm font-medium text-accent-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar open={mobileNav} onClose={() => setMobileNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileNav(true)} />
        <ConnectionBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto outline-none"
        >
          <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
            {children}
          </Suspense>
        </main>
      </div>
      <CommandMenu />
    </div>
  );
}
