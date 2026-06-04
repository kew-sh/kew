import { cn } from "@/lib/utils";

/** Tiny throughput sparkline with an optional failures overlay. SVG, no deps. */
export function Sparkline({
  data,
  failures,
  className,
  width = 104,
  height = 28,
}: {
  data: number[];
  failures?: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const all = failures ? [...data, ...failures] : data;
  const max = Math.max(1, ...all);
  const n = data.length;
  const toPoints = (arr: number[]) =>
    arr
      .map((v, i) => {
        const x = n <= 1 ? 0 : (i / (n - 1)) * width;
        const y = height - (v / max) * (height - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const area = `0,${height} ${toPoints(data)} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("text-ink-2", className)}
      aria-hidden
    >
      <polygon points={area} fill="currentColor" opacity={0.08} />
      <polyline
        points={toPoints(data)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {failures && failures.some((f) => f > 0) && (
        <polyline
          points={toPoints(failures)}
          fill="none"
          stroke="var(--failed)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
