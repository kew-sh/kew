import { queueHealth } from "@kew/core";
import { useNavigate } from "@tanstack/react-router";
import { LayoutGrid, MoonStar } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueues } from "../lib/use-queues";
import { StateDot } from "./state-badge";
import { useTheme } from "./theme";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";

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

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      showCloseButton={false}
      title="Command menu"
      description="Jump to a queue or run an action"
    >
      <CommandInput placeholder="Jump to a queue, run an action…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Queues">
          {queues?.map((q) => (
            <CommandItem
              key={q.name}
              value={`queue ${q.name}`}
              onSelect={() =>
                run(() => navigate({ to: "/queues/$queueName", params: { queueName: q.name } }))
              }
            >
              <StateDot state={queueHealth(q)} />
              <span className="font-mono">{q.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Go to">
          <CommandItem value="overview" onSelect={() => run(() => navigate({ to: "/" }))}>
            <LayoutGrid />
            Overview
          </CommandItem>
          <CommandItem value="toggle theme" onSelect={() => run(toggle)}>
            <MoonStar />
            Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
