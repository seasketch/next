jest.mock("../../../../editor/config", () => {
  const { schema } = require("prosemirror-schema-basic");
  return {
    baseSchema: schema,
  };
});

// eslint-disable-next-line import/first -- jest.mock above must precede imports that use the mocked module path
import { Fragment, Node, Slice } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { reportBodySchema } from "../reportBodySchema";
import {
  createProtectTabContainerPlugin,
  unwrapTabContainersInSlice,
} from "./protectTabContainerPlugin";

function paragraph(text?: string) {
  return text
    ? reportBodySchema.node("paragraph", null, reportBodySchema.text(text))
    : reportBodySchema.node("paragraph");
}

function tabContainer(panels: { id: string; label: string; text?: string }[]) {
  return reportBodySchema.node(
    "tabContainer",
    null,
    panels.map((panel) =>
      reportBodySchema.node(
        "tabPanel",
        { id: panel.id, label: panel.label },
        [paragraph(panel.text)]
      )
    )
  );
}

function tabbedDoc() {
  return Node.fromJSON(reportBodySchema, {
    type: "doc",
    content: [
      { type: "reportTitle", content: [{ type: "text", text: "Title" }] },
      {
        type: "tabContainer",
        content: [
          {
            type: "tabPanel",
            attrs: { id: "a", label: "Emau" },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Hello" }],
              },
            ],
          },
          {
            type: "tabPanel",
            attrs: { id: "b", label: "Torba" },
            content: [{ type: "paragraph" }],
          },
        ],
      },
    ],
  });
}

function childTypes(slice: Slice): string[] {
  const types: string[] = [];
  slice.content.forEach((node) => types.push(node.type.name));
  return types;
}

describe("unwrapTabContainersInSlice", () => {
  test("inlines panel contents and drops the tabContainer", () => {
    const slice = new Slice(
      Fragment.fromArray([
        reportBodySchema.node("reportTitle"),
        tabContainer([{ id: "x", label: "Pasted", text: "From clipboard" }]),
      ]),
      0,
      0
    );
    const next = unwrapTabContainersInSlice(slice);
    expect(childTypes(next)).toEqual(["reportTitle", "paragraph"]);
    expect(next.content.child(1).textContent).toBe("From clipboard");
  });

  test("inlines every panel when several tabs are pasted", () => {
    const slice = new Slice(
      Fragment.fromArray([
        tabContainer([
          { id: "a", label: "A", text: "One" },
          { id: "b", label: "B", text: "Two" },
        ]),
      ]),
      0,
      0
    );
    const next = unwrapTabContainersInSlice(slice);
    expect(childTypes(next)).toEqual(["paragraph", "paragraph"]);
    expect(next.content.child(0).textContent).toBe("One");
    expect(next.content.child(1).textContent).toBe("Two");
  });

  test("leaves a slice without tabs unchanged", () => {
    const slice = new Slice(Fragment.fromArray([paragraph("Plain")]), 0, 0);
    expect(unwrapTabContainersInSlice(slice)).toBe(slice);
  });
});

describe("createProtectTabContainerPlugin", () => {
  test("rejects deleting the only tabContainer", () => {
    const plugin = createProtectTabContainerPlugin();
    const state = EditorState.create({
      schema: reportBodySchema,
      doc: tabbedDoc(),
      plugins: [plugin],
    });
    const containerPos = state.doc.child(0).nodeSize;
    const tr = state.tr.delete(
      containerPos,
      containerPos + state.doc.child(1).nodeSize
    );
    expect(plugin.spec.filterTransaction!(tr, state)).toBe(false);
  });

  test("rejects inserting a second top-level tabContainer", () => {
    const plugin = createProtectTabContainerPlugin();
    const state = EditorState.create({
      schema: reportBodySchema,
      doc: tabbedDoc(),
      plugins: [plugin],
    });
    const tr = state.tr.insert(
      state.doc.content.size,
      tabContainer([{ id: "z", label: "Extra" }])
    );
    expect(plugin.spec.filterTransaction!(tr, state)).toBe(false);
  });

  test("transformPasted unwraps a pasted tabContainer", () => {
    const plugin = createProtectTabContainerPlugin();
    const transform = plugin.spec.props?.transformPasted;
    expect(typeof transform).toBe("function");
    const slice = new Slice(
      Fragment.fromArray([
        tabContainer([{ id: "x", label: "Pasted", text: "From clipboard" }]),
      ]),
      0,
      0
    );
    const view = {} as Parameters<NonNullable<typeof transform>>[1];
    const next = transform!.call(plugin, slice, view);
    expect(childTypes(next)).toEqual(["paragraph"]);
    expect(next.content.child(0).textContent).toBe("From clipboard");
  });
});
