import {
  applyCardTabEdits,
  docHasTabContainer,
  listCardTabs,
  tabPanelHasContent,
  unwrapCardBodyTabs,
  wrapCardBodyInTabs,
  type PMJSONNode,
} from "./wrapCardInTabs";

function titleDoc(blocks: PMJSONNode[]): PMJSONNode {
  return {
    type: "doc",
    content: [{ type: "reportTitle", content: [{ type: "text", text: "Title" }] }, ...blocks],
  };
}

describe("wrapCardInTabs", () => {
  test("wraps body after the title into the first panel", () => {
    const doc = titleDoc([
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "blockMetric", attrs: { type: "OusDemographicsTable", metrics: [{ type: "count" }] } },
    ]);
    const next = wrapCardBodyInTabs(doc, ["Emau", "Torba"]);
    expect(docHasTabContainer(next)).toBe(true);
    expect(listCardTabs(next).map((t) => t.label)).toEqual(["Emau", "Torba"]);
    const container = next.content![1];
    expect(container.type).toBe("tabContainer");
    expect(container.content).toHaveLength(2);
    expect(container.content![0].content).toHaveLength(2);
    expect(container.content![0].content![0].type).toBe("paragraph");
    expect(container.content![1].content).toEqual([{ type: "paragraph" }]);
  });

  test("is a no-op when tabs already exist", () => {
    const doc = wrapCardBodyInTabs(titleDoc([]), ["A", "B"]);
    const again = wrapCardBodyInTabs(doc, ["C", "D"]);
    expect(listCardTabs(again).map((t) => t.label)).toEqual(["A", "B"]);
  });

  test("unwrap inlines every panel in order", () => {
    const wrapped = wrapCardBodyInTabs(
      titleDoc([{ type: "paragraph", content: [{ type: "text", text: "One" }] }]),
      ["A", "B"]
    );
    const withSecond = applyCardTabEdits(wrapped, [
      listCardTabs(wrapped)[0],
      { ...listCardTabs(wrapped)[1], label: "B" },
    ]);
    const tabs = listCardTabs(withSecond);
    const edited = applyCardTabEdits(withSecond, [
      tabs[0],
      tabs[1],
      { id: "new-tab", label: "C" },
    ]);
    const unwrapped = unwrapCardBodyTabs(edited);
    expect(docHasTabContainer(unwrapped)).toBe(false);
    const types = (unwrapped.content || []).map((n) => n.type);
    expect(types[0]).toBe("reportTitle");
    expect(types.slice(1)).toEqual(["paragraph", "paragraph", "paragraph"]);
  });

  test("applyCardTabEdits renames, reorders, and drops panels", () => {
    const wrapped = wrapCardBodyInTabs(
      titleDoc([{ type: "paragraph", content: [{ type: "text", text: "Keep" }] }]),
      ["A", "B"]
    );
    const [first, second] = listCardTabs(wrapped);
    const next = applyCardTabEdits(wrapped, [
      { id: second.id, label: "Second" },
      { id: first.id, label: "First" },
    ]);
    expect(listCardTabs(next).map((t) => t.label)).toEqual(["Second", "First"]);
    const firstPanel = next.content![1].content![1];
    expect(firstPanel.content![0].content![0].text).toBe("Keep");
  });

  test("first-enable rename applies to the wrapped snapshot, not the original body", () => {
    const original = titleDoc([
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ]);
    const wrapped = wrapCardBodyInTabs(original, ["Tab 1", "Tab 2"]);
    const [first, second] = listCardTabs(wrapped);
    const named = applyCardTabEdits(wrapped, [
      { id: first.id, label: "Emau" },
      { id: second.id, label: "Torba" },
    ]);
    expect(listCardTabs(named).map((t) => t.label)).toEqual(["Emau", "Torba"]);
    expect(docHasTabContainer(applyCardTabEdits(original, [
      { id: first.id, label: "Emau" },
      { id: second.id, label: "Torba" },
    ]))).toBe(false);
  });

  test("tabPanelHasContent ignores empty paragraphs", () => {
    const wrapped = wrapCardBodyInTabs(
      titleDoc([{ type: "paragraph", content: [{ type: "text", text: "Keep" }] }]),
      ["A", "B"]
    );
    const [first, second] = listCardTabs(wrapped);
    expect(tabPanelHasContent(wrapped, first.id)).toBe(true);
    expect(tabPanelHasContent(wrapped, second.id)).toBe(false);
  });
});
