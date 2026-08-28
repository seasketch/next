import { describe, expect, it } from "vitest";
import { markdownToProseMirror } from "../src/markdownToProseMirror";

describe("markdownToProseMirror", () => {
  it("returns nothing for empty input", () => {
    expect(markdownToProseMirror("")).toEqual([]);
    expect(markdownToProseMirror("   ")).toEqual([]);
  });

  it("converts emphasis, lists, headings, and links", () => {
    const nodes = markdownToProseMirror(
      "Legally defined __Regional District__ polygons.\n\n- One\n- Two\n\nSee [source](https://example.com)."
    );
    expect(nodes[0]?.type).toBe("paragraph");
    const marks = JSON.stringify(nodes);
    expect(marks).toContain('"type":"strong"');
    expect(nodes.some((node) => node.type === "bullet_list")).toBe(true);
    expect(marks).toContain("https://example.com");
  });

  it("escapes embedded HTML instead of injecting it", () => {
    const nodes = markdownToProseMirror('Hello <script>alert("x")</script>');
    expect(nodes).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: 'Hello <script>alert("x")</script>' }],
      },
    ]);
  });
});
