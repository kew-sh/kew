import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { LayoutGrid, MoonStar, Search } from "lucide-react";
import { useQueues, queueHealth } from "@queue-panel/core";
import { useTheme } from "./theme";
import { StateDot } from "./state-badge";

/** ⌘K palette. Listens for the shortcut globally and a custom open event. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: queues } = useQueues();
  const { toggle } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("command-menu:open", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("command-menu:open", onOpen);
    };
  }, []);

  if (!open) return null;

  const close = () => setOpen(false);
  const go = (to: string, params?: Record<string, string>) => {
    close();
    navigate({ to, params } as never);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[14vh] backdrop-blur-[2px]"
      onClick={close}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <Command
        label="Command menu"
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line-strong bg-overlay shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-muted" />
          <Command.Input
            autoFocus
            placeholder="Jump to a queue, run an action…"
            className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <Command.List className="max-h-[min(60vh,380px)] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
            No matches.
          </Command.Empty>

          <Command.Group
            heading="Queues"
            className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
          >
            {queues?.map((q) => (
              <Command.Item
                key={q.name}
                value={`queue ${q.name}`}
                onSelect={() => go("/queues/$queueName", { queueName: q.name })}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-ink-2 data-[selected=true]:bg-surface data-[selected=true]:text-ink"
              >
                <StateDot state={queueHealth(q)} />
                <span className="font-mono">{q.name}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            heading="Go to"
            className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
          >
            <Item onSelect={() => go("/")} icon={<LayoutGrid className="size-4" />}>
              Overview
            </Item>
            <Item
              onSelect={() => {
                toggle();
                close();
              }}
              icon={<MoonStar className="size-4" />}
            >
              Toggle theme
            </Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Item({
  children,
  icon,
  onSelect,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-ink-2 data-[selected=true]:bg-surface data-[selected=true]:text-ink"
    >
      <span className="text-muted">{icon}</span>
      {children}
    </Command.Item>
  );
}
