import { GitFork, Workflow } from "lucide-react";
import { useFlows, type FlowNode } from "@kew/core";
import { StateBadge, StateDot } from "@/components/state-badge";

export function FlowsPage() {
  const { data: flows } = useFlows();

  return (
    <div className="mx-auto max-w-270 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Flows</h1>
        <p className="mt-0.5 text-sm text-muted">Parent / child job trees (BullMQ Flows)</p>
      </header>

      <div className="mt-6 space-y-4">
        {flows?.length === 0 && <EmptyFlows />}
        {flows?.map((root) => (
          <section key={root.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs text-muted">
              <GitFork className="size-3.5" />
              <span className="font-mono">{root.queue}</span>
            </div>
            <FlowTree node={root} />
          </section>
        ))}
      </div>
    </div>
  );
}

function FlowTree({ node }: { node: FlowNode }) {
  return (
    <div>
      <NodeRow node={node} />
      {node.children.length > 0 && (
        <div className="ml-[15px] mt-1 space-y-1 border-l border-line pl-3">
          {node.children.map((child) => (
            <FlowTree key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeRow({ node }: { node: FlowNode }) {
  const isParent = node.children.length > 0;
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-overlay">
      <StateDot state={node.state} pulse={node.state === "active"} />
      <span className="text-sm font-medium">{node.name}</span>
      <span className="font-mono text-xs text-muted">#{node.id}</span>
      {isParent && (
        <span className="text-[11px] text-muted/70">
          {node.children.length} {node.children.length === 1 ? "child" : "children"}
        </span>
      )}
      <span className="ml-auto">
        <StateBadge state={node.state} />
      </span>
    </div>
  );
}

function EmptyFlows() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
      <Workflow className="size-7 text-muted" />
      <h2 className="mt-3 text-sm font-medium text-ink">No flows yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Flows appear when you enqueue parent jobs with children via BullMQ's FlowProducer. The parent
        waits in <span className="font-mono">waiting-children</span> until its children finish.
      </p>
    </div>
  );
}
