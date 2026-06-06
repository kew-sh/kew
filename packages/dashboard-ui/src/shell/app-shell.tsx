import { Suspense } from "react";
import { CommandMenu } from "../components/command-menu";
import { SidebarInset, SidebarProvider } from "../components/ui/sidebar";
import { ConnectionBanner } from "./connection-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-screen overflow-hidden bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only z-100 rounded-md bg-accent-strong px-3 py-2 text-sm font-medium text-accent-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <Topbar />
        <ConnectionBanner />
        <div
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto outline-none"
        >
          <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
            {children}
          </Suspense>
        </div>
      </SidebarInset>
      <CommandMenu />
    </SidebarProvider>
  );
}
