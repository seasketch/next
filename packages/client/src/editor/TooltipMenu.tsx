import { LinkIcon } from "@heroicons/react/outline";
import { AnimatePresence, motion } from "framer-motion";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { Mark, Node, Schema } from "prosemirror-model";
import { EditorState, Transaction, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ReactNode } from "react";
import { TFunction, useTranslation } from "react-i18next";
import { getActiveMarks } from "./EditorMenuBar";

/**
 * Check if the selection is exclusively a metric node (no other content)
 */
function selectionIsOnlyMetricNode(
  state: EditorState,
  schema: Schema
): boolean {
  if (!state.selection || state.selection.empty) {
    return false;
  }

  const metricNodeType = schema.nodes.metric;
  if (!metricNodeType) {
    return false;
  }

  const { from, to } = state.selection;

  // Check if the selection spans exactly one node and it's a metric node
  let nodeAtFrom = state.doc.nodeAt(from);
  if (nodeAtFrom && nodeAtFrom.type === metricNodeType) {
    // Check if the selection is entirely within this metric node
    const nodeEnd = from + nodeAtFrom.nodeSize;
    if (to <= nodeEnd) {
      return true;
    }
  }

  // Also check if selection starts right before a metric node and spans only that node
  const $from = state.doc.resolve(from);
  const nodeAfter = $from.nodeAfter;
  if (nodeAfter && nodeAfter.type === metricNodeType) {
    const nodeEnd = from + nodeAfter.nodeSize;
    if (to === nodeEnd) {
      return true;
    }
  }

  return false;
}

/**
 * Get the metric node from the selection if it's exclusively a metric node
 */
function getSelectedMetricNode(
  state: EditorState,
  schema: Schema
): { node: Node; pos: number } | null {
  if (!state.selection || state.selection.empty) {
    return null;
  }

  const metricNodeType = schema.nodes.metric;
  if (!metricNodeType) {
    return null;
  }

  const { from, to } = state.selection;

  // Check if the selection spans exactly one node and it's a metric node
  let nodeAtFrom = state.doc.nodeAt(from);
  if (nodeAtFrom && nodeAtFrom.type === metricNodeType) {
    const nodeEnd = from + nodeAtFrom.nodeSize;
    if (to <= nodeEnd) {
      return { node: nodeAtFrom, pos: from };
    }
  }

  // Also check if selection starts right before a metric node and spans only that node
  const $from = state.doc.resolve(from);
  const nodeAfter = $from.nodeAfter;
  if (nodeAfter && nodeAfter.type === metricNodeType) {
    const nodeEnd = from + nodeAfter.nodeSize;
    if (to === nodeEnd) {
      return { node: nodeAfter, pos: from };
    }
  }

  return null;
}

export default function TooltipMenu({
  state,
  schema,
  view,
}: {
  schema: Schema;
  view?: EditorView;
  state?: EditorState;
}) {
  const { t } = useTranslation("admin:surveys");
  let commands: Command[] = [];
  let left = "-10000px";
  let bottom = "-10000px";
  const selectedMetric = state ? getSelectedMetricNode(state, schema) : null;
  const isOnlyMetricNode = state
    ? selectionIsOnlyMetricNode(state, schema)
    : false;

  // Calculate position if we have a selection or a metric node
  if (
    view &&
    state?.selection &&
    (state.selection.to - state.selection.from > 0 || isOnlyMetricNode)
  ) {
    commands = Commands.filter((command) => {
      // Disable mark commands if selection is exclusively a metric node
      if (
        isOnlyMetricNode &&
        (command.id === "strong" ||
          // command.id === "em" ||
          command.id === "link")
      ) {
        return false;
      }
      // Disable block type commands if selection is exclusively a metric node (metrics are inline)
      if (
        isOnlyMetricNode &&
        (command.id === "paragraph" ||
          command.id === "h1" ||
          command.id === "h2" ||
          command.id === "h2b" ||
          command.id === "h3")
      ) {
        return false;
      }
      return !command.isDisabled(schema, state);
    });
    if (commands.length || isOnlyMetricNode) {
      let { from, to } = state.selection;
      // For metric nodes, use the node position for positioning
      if (isOnlyMetricNode && selectedMetric) {
        from = selectedMetric.pos;
        to = selectedMetric.pos + selectedMetric.node.nodeSize;
      }
      let start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      let box = view.dom.getBoundingClientRect();
      left =
        Math.max((start.left + end.left) / 2, start.left + 3) - box.left + "px";
      bottom = box.bottom - start.top + 5 + "px";
    }
  }
  let activeMarks: { [id: string]: boolean } = {};
  if (state) {
    activeMarks = getActiveMarks(state, [schema.marks.strong, schema.marks.em]);
  }
  const updateMetricNode = (attrs: {
    style?: string;
    unit?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }) => {
    if (!selectedMetric || !state || !view) return;

    const { node, pos } = selectedMetric;
    const { from, to } = state.selection;

    const tr = state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      componentSettings: {
        ...node.attrs.componentSettings,
        ...attrs,
      },
    });

    // After updating the node, ensure the selection still spans the metric node
    // The node size might have changed, so we need to recalculate the selection
    const newDoc = tr.doc;
    const newMetricNode = newDoc.nodeAt(pos);
    if (newMetricNode && newMetricNode.type === schema.nodes.metric) {
      const nodeEnd = pos + newMetricNode.nodeSize;
      // Preserve the selection range to keep the tooltip open
      const newSelection = TextSelection.create(
        newDoc,
        from,
        Math.min(to, nodeEnd)
      );
      tr.setSelection(newSelection);
    } else {
      // Fallback: preserve original selection
      tr.setSelection(state.selection);
    }

    view.dispatch(tr);
  };

  return (
    <AnimatePresence>
      {commands.length > 0 || isOnlyMetricNode ? (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0,
            translateX: "-50%",
          }}
          animate={{
            opacity: 1,
            scale: 1,
            translateX: "-50%",
          }}
          exit={{ opacity: 0, scale: 1, translateX: "-50%" }}
          key="tooltip"
          className={`bg-black text-white rounded shadow-sm absolute z-10 ${
            isOnlyMetricNode ? "flex-col" : "flex overflow-hidden"
          }`}
          style={{
            left,
            bottom,
            marginLeft: 0,
            // marginLeft: isOnlyMetricNode ? 0 : -16 * commands.length,
            transform: "translateX(-50%)",
            boxShadow: "rgb(0 0 0 / 50%) 1px 3px 10px 0px",
          }}
          onMouseDown={(e) => {
            // Prevent editor from handling mouse events when interacting with tooltip
            if (isOnlyMetricNode) {
              e.stopPropagation();
            }
          }}
        >
          {commands.length > 0 && (
            <div className="flex overflow-hidden items-center">
              {commands.map((c) => (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    c.toggle(schema, state!, view!.dispatch, t);
                    e.preventDefault();
                    return false;
                  }}
                  className={`w-8 h-8 justify-center items-center flex ${
                    !!activeMarks[c.id] ? "bg-gray-800" : ""
                  }`}
                  key={c.id}
                >
                  {c.icon}
                </button>
              ))}
              {isOnlyMetricNode && selectedMetric && state && view && (
                <MetricFormattingControls
                  node={selectedMetric.node}
                  onUpdate={updateMetricNode}
                />
              )}
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MetricFormattingControls({
  node,
  onUpdate,
}: {
  node: Node;
  onUpdate: (attrs: {
    style?: string;
    unit?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }) => void;
}) {
  const { t } = useTranslation("admin:sketching");
  const attrs = node.attrs;
  const metricType = attrs.metrics?.[0]?.type;
  // const [style, setStyle] = useState(attrs.style || "decimal");
  // const [minFrac, setMinFrac] = useState(attrs.minimumFractionDigits ?? 0);
  // const [maxFrac, setMaxFrac] = useState(attrs.maximumFractionDigits ?? 2);

  // const handleUnitChange = (newUnit: string) => {
  //   onUpdate({
  //     style,
  //     unit: newUnit || undefined,
  //     minimumFractionDigits: minFrac,
  //     maximumFractionDigits: maxFrac,
  //   });
  // };

  return (
    <>
      {metricType === "total_area" && (
        <>
          {/* <label className="block text-xs font-semibold text-gray-300 mb-1">
              {t("Unit")}
            </label> */}
          <select
            value={attrs.componentSettings?.unit || "square-kilometer"}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-auto px-4 pr-8 text-sm bg-transparent border-none text-white  rounded outline-none focus:outline-none active:outline-none focus:ring-0"
          >
            <option value="kilometer">{t("km²")}</option>
            <option value="hectare">{t("ha")}</option>
            <option value="acre">{t("acre")}</option>
            <option value="mile">{t("mi²")}</option>
          </select>
        </>
      )}
    </>
    // <div className="inline-block border-t border-gray-700 p-2 space-y-2 min-w-[240px]">
    //   <div className="flex items-center space-x-1">

    //   </div>
    //   {/* <div className="grid grid-cols-2 gap-2">
    //     <div>
    //       <label className="block text-xs font-semibold text-gray-300 mb-1">
    //         Min
    //       </label>
    //       <input
    //         type="number"
    //         min="0"
    //         max="20"
    //         value={minFrac}
    //         onChange={(e) => handleMinFracChange(e.target.value)}
    //         onMouseDown={(e) => e.stopPropagation()}
    //         onClick={(e) => e.stopPropagation()}
    //         className="w-full px-2 py-1 text-sm bg-gray-800 text-white border border-gray-600 rounded"
    //       />
    //     </div>
    //     <div>
    //       <label className="block text-xs font-semibold text-gray-300 mb-1">
    //         Max
    //       </label>
    //       <input
    //         type="number"
    //         min="0"
    //         max="20"
    //         value={maxFrac}
    //         onChange={(e) => handleMaxFracChange(e.target.value)}
    //         onMouseDown={(e) => e.stopPropagation()}
    //         onClick={(e) => e.stopPropagation()}
    //         className="w-full px-2 py-1 text-sm bg-gray-800 text-white border border-gray-600 rounded"
    //       />
    //     </div>
    //   </div>*/}
    // </div>
  );
}

interface Command {
  id: string;
  icon: ReactNode;
  isDisabled: (schema: Schema, state: EditorState) => boolean;
  toggle: (
    schema: Schema,
    state: EditorState,
    dispatch: (tr: Transaction) => void,
    t: TFunction<string>
  ) => void;
}

const Commands: Command[] = [
  {
    id: "strong",
    icon: "B",
    isDisabled: (schema, state) => !toggleMark(schema.marks.strong)(state),
    toggle: (schema, state, dispatch) => {
      toggleMark(schema.marks.strong)(state, dispatch);
    },
  },
  {
    id: "em",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <em>i</em>,
    isDisabled: (schema, state) => !toggleMark(schema.marks.em)(state),
    toggle: (schema, state, dispatch) => {
      toggleMark(schema.marks.em)(state, dispatch);
    },
  },
  {
    id: "link",
    icon: <LinkIcon className="w-3.5 h-3.5" />,
    isDisabled: (schema, state) => !toggleMark(schema.marks.link)(state),
    toggle: (schema, state, dispatch, t) => {
      const links = getActiveLinks(state);
      const existingUrl =
        links && links.length ? links[0]?.attrs?.href : "https://";
      const url = window.prompt(
        t("Enter a URL", { ns: "common" }),
        existingUrl
      );
      if (url === null || url === existingUrl) {
        return;
      } else {
        if (url.length === 0) {
          toggleMark(schema.marks.link, { href: null })(state, dispatch);
        } else {
          toggleMark(schema.marks.link, { href: url })(state, dispatch);
        }
      }
    },
  },
  {
    id: "paragraph",
    icon: "¶",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.paragraph)(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.paragraph)(state, dispatch);
    },
  },
  {
    id: "h1",
    icon: "H1",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 1 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 1 })(state, dispatch);
    },
  },
  {
    id: "h2",
    // eslint-disable-next-line i18next/no-literal-string
    icon: "H2",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 2 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 2 })(state, dispatch);
    },
  },
  {
    id: "h2b",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <strong>H</strong>,
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.h2)(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.h2)(state, dispatch);
    },
  },
  {
    id: "h3",
    icon: "H3",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 3 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 3 })(state, dispatch);
    },
  },
];

export function getActiveLinks(state: EditorState) {
  if (!state.selection.empty) {
    const links: Mark[] = [];
    state.doc.nodesBetween(
      state.selection.from,
      state.selection.to,
      (node, position) => {
        node.marks.forEach((mark) => {
          if (mark.type.name === "link" && links.indexOf(mark) === -1) {
            links.push(mark);
          }
        });
      }
    );
    return links;
  }
}
