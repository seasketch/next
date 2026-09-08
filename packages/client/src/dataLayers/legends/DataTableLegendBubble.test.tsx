/* eslint-disable i18next/no-literal-string */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import DataTableLegendBubble, {
  formatLegendNumber,
} from "./DataTableLegendBubble";

describe("formatLegendNumber", () => {
  it("rounds values below 1 to at most two decimal places", () => {
    expect(formatLegendNumber(0.038)).toBe("0.04");
    expect(formatLegendNumber(0.04)).toBe("0.04");
    expect(formatLegendNumber(0.123)).toBe("0.12");
  });

  it("uses one decimal for values of 1 and above", () => {
    expect(formatLegendNumber(49.2)).toBe("49.2");
    expect(formatLegendNumber(24.6)).toBe("24.6");
  });

  it("renders a true zero as 0", () => {
    expect(formatLegendNumber(0)).toBe("0");
  });
});

describe("DataTableLegendBubble", () => {
  it("does not put 0 on the stacked positive scale", () => {
    const { container } = render(
      <DataTableLegendBubble min={0.038} max={49.2} hasZero />
    );
    const labels = Array.from(container.querySelectorAll("text")).map(
      (node) => node.textContent
    );
    expect(labels).toContain("0.04");
    expect(labels).toContain("49.2");
    expect(labels).not.toContain("0");
    expect(screen.getByText("0")).toBeInTheDocument();
    const xs = Array.from(container.querySelectorAll("text")).map((node) =>
      node.getAttribute("x")
    );
    expect(new Set(xs).size).toBe(1);
    expect(container.querySelectorAll("line").length).toBe(0);
  });

  it("hides the dedicated zero mark when the query has no zeros", () => {
    render(<DataTableLegendBubble min={4} max={10} hasZero={false} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});
