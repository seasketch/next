jest.mock("../../../../editor/config", () => {
  const { schema } = require("prosemirror-schema-basic");
  return {
    baseSchema: schema,
  };
});

// eslint-disable-next-line import/first -- jest.mock above must precede imports that use the mocked module path
import { Node } from "prosemirror-model";
import { reportBodySchema } from "../reportBodySchema";
import {
  clearSelectedCardTabId,
  getSelectedCardTabId,
  indexOfCardTabId,
  setSelectedCardTabId,
  tabIdAtIndex,
} from "./selectedCardTab";

function tabContainerNode() {
  return Node.fromJSON(reportBodySchema, {
    type: "tabContainer",
    content: [
      {
        type: "tabPanel",
        attrs: { id: "ema", label: "Emau" },
        content: [{ type: "paragraph" }],
      },
      {
        type: "tabPanel",
        attrs: { id: "tor", label: "Torba" },
        content: [{ type: "paragraph" }],
      },
    ],
  });
}

describe("selectedCardTab", () => {
  afterEach(() => {
    clearSelectedCardTabId(99);
  });

  test("remembers a tab id for a card and resolves it to an index", () => {
    const node = tabContainerNode();
    setSelectedCardTabId(99, "tor");
    expect(getSelectedCardTabId(99)).toBe("tor");
    expect(indexOfCardTabId(node, getSelectedCardTabId(99))).toBe(1);
    expect(tabIdAtIndex(node, 1)).toBe("tor");
  });

  test("falls back to the first tab when the stored id is gone", () => {
    const node = tabContainerNode();
    expect(indexOfCardTabId(node, "missing")).toBe(0);
  });
});
