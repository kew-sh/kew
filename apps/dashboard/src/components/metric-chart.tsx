import { cn } from "../lib/utils";

export function MetricChart({
  data,
  failures,
  className,
  height = 72,
  label,
}: {
  data: number[];
  failures?: number[];
  className?: string;
  height?: number;
  label?: string;
}) {
  const W = 600;
  const H = height;
  const all = failures ? [...data, ...failures] : data;
  const max = Math.max(1, ...all);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * (H - 4) - 2;
  const line = (arr: number[]) =>
    arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `0,${H} ${line(data)} ${W},${H}`;

  const total = data.reduce((a, b) => a + b, 0);
  const failTotal = failures?.reduce((a, b) => a + b, 0) ?? 0;
  const summary = `${label ? `${label}: ` : ""}${total} completed, ${failTotal} failed over the window`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ height: H }}
      preserveAspectRatio="none"
      className={cn("w-full text-accent", className)}
      role="img"
      aria-label={summary}
    >
      <polygon points={area} fill="currentColor" opacity={0.1} />
      <polyline
        points={line(data)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {failures?.some((f) => f > 0) && (
        <polyline
          points={line(failures)}
          fill="none"
          stroke="var(--failed)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
