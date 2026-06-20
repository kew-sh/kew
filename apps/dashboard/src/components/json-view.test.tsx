import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonView } from "./json-view";

describe("JsonView", () => {
  it("renders the keys and values of an object as pretty JSON", () => {
    const { container } = render(<JsonView value={{ name: "emails", count: 3 }} />);
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    const text = pre?.textContent ?? "";
    expect(text).toContain('"name"');
    expect(text).toContain('"emails"');
    expect(text).toContain('"count"');
    expect(text).toContain("3");
  });

  it("renders nested structures", () => {
    const { container } = render(<JsonView value={{ opts: { attempts: 5 }, tags: ["a", "b"] }} />);
    const text = container.querySelector("pre")?.textContent ?? "";
    expect(text).toContain('"opts"');
    expect(text).toContain('"attempts"');
    expect(text).toContain("5");
    expect(text).toContain('"tags"');
    expect(text).toContain('"a"');
    expect(text).toContain('"b"');
  });

  it("forwards an extra className onto the pre element", () => {
    const { container } = render(<JsonView value={{ a: 1 }} className="extra-cls" />);
    expect(container.querySelector("pre")).toHaveClass("extra-cls");
  });
});
