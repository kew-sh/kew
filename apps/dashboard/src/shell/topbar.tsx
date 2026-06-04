import { Menu, Search } from "lucide-react";
import { StateDot } from "@/components/state-badge";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-3 backdrop-blur">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </Button>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("command-menu:open"))}
        className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-sm text-muted transition-colors hover:border-line-strong"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Jump to a queue or job…</span>
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <StateDot state="completed" pulse />
          Live
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
