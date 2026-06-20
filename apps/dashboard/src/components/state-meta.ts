import {
  Activity,
  ArrowUp,
  Check,
  Circle,
  GitBranch,
  type LucideIcon,
  Pause,
  Timer,
  X,
} from "lucide-react";
import type { JobState } from "@/lib/api";

export interface StateMeta {
  label: string;
  icon: LucideIcon;
  text: string;
  bg: string;
  dot: string;
}

export const STATE_META: Record<JobState, StateMeta> = {
  active: {
    label: "Active",
    icon: Activity,
    text: "text-active",
    bg: "bg-active/12",
    dot: "bg-active",
  },
  waiting: {
    label: "Waiting",
    icon: Circle,
    text: "text-waiting",
    bg: "bg-waiting/12",
    dot: "bg-waiting",
  },
  prioritized: {
    label: "Prioritized",
    icon: ArrowUp,
    text: "text-prioritized",
    bg: "bg-prioritized/12",
    dot: "bg-prioritized",
  },
  delayed: {
    label: "Delayed",
    icon: Timer,
    text: "text-delayed",
    bg: "bg-delayed/12",
    dot: "bg-delayed",
  },
  "waiting-children": {
    label: "Children",
    icon: GitBranch,
    text: "text-children",
    bg: "bg-children/12",
    dot: "bg-children",
  },
  completed: {
    label: "Completed",
    icon: Check,
    text: "text-completed",
    bg: "bg-completed/12",
    dot: "bg-completed",
  },
  failed: { label: "Failed", icon: X, text: "text-failed", bg: "bg-failed/12", dot: "bg-failed" },
  paused: {
    label: "Paused",
    icon: Pause,
    text: "text-paused",
    bg: "bg-paused/12",
    dot: "bg-paused",
  },
};
