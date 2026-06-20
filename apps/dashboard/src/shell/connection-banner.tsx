import { Unplug } from "lucide-react";
import { useConnection } from "../lib/use-connection";

export function ConnectionBanner() {
  const { data: conn } = useConnection();
  if (conn?.status !== "error") return null;
  return (
    <div className="flex items-center gap-2 border-b border-failed/30 bg-failed/10 px-4 py-1.5 text-xs text-failed md:px-8">
      <Unplug className="size-3.5 shrink-0" strokeWidth={2.25} />
      <span className="min-w-0 truncate">
        Lost connection to Redis (<span className="font-mono">{conn.url}</span>). Retrying…
      </span>
    </div>
  );
}
