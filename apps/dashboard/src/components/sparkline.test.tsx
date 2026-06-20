import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("renders an svg with a polyline for the data series", () => {
    const { container } = render(<Sparkline data={[1, 4, 2, 8, 3]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(container.querySelector("polyline")).toBeInTheDocument();
    expect(container.querySelector("polygon")).toBeInTheDocument();
  });

  it("renders a failures overlay polyline only when there are non-zero failures", () => {
    const withFailures = render(<Sparkline data={[1, 2, 3]} failures={[0, 1, 0]} />);
    expect(withFailures.container.querySelectorAll("polyline")).toHaveLength(2);

    const noFailures = render(<Sparkline data={[1, 2, 3]} failures={[0, 0, 0]} />);
    expect(noFailures.container.querySelectorAll("polyline")).toHaveLength(1);
  });

  it("renders without throwing for an empty or single-point series", () => {
    expect(() => render(<Sparkline data={[]} />)).not.toThrow();
    expect(() => render(<Sparkline data={[5]} />)).not.toThrow();
  });

  it("honours custom width and height", () => {
    const { container } = render(<Sparkline data={[1, 2]} width={50} height={10} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "50");
    expect(svg).toHaveAttribute("height", "10");
    expect(svg).toHaveAttribute("viewBox", "0 0 50 10");
  });
});
