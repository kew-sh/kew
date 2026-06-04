import { Suspense, useState } from "react";
import { CommandMenu } from "@/components/command-menu";
import { ConnectionBanner } from "./connection-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <Sidebar open={mobileNav} onClose={() => setMobileNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileNav(true)} />
        <ConnectionBanner />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
            {children}
          </Suspense>
        </main>
      </div>
      <CommandMenu />
    </div>
  );
}
