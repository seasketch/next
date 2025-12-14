import { LinkIcon } from "@heroicons/react/outline";
import { AnimatePresence, motion } from "framer-motion";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { Mark, Node, Schema } from "prosemirror-model";
import { EditorState, Transaction, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { TFunction, useTranslation } from "react-i18next";
import { getActiveMarks } from "./EditorMenuBar";
import { ReportWidgetTooltipControlsRouter } from "../reports/widgets/widgets";

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
  const [position, setPosition] = useState<{
    left: string;
    bottom: string;
  } | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [activeMarks, setActiveMarks] = useState<{ [id: string]: boolean }>({});

  // Memoize these to prevent infinite loops
  const selectedMetric = useMemo(
    () => (state ? getSelectedMetricNode(state, schema) : null),
    [state, schema]
  );
  const isOnlyMetricNode = useMemo(
    () => (state ? selectionIsOnlyMetricNode(state, schema) : false),
    [state, schema]
  );

  // Calculate position function
  const calculatePosition = useCallback(() => {
    if (
      !view ||
      !state?.selection ||
      (state.selection.to - state.selection.from === 0 && !isOnlyMetricNode)
    ) {
      setPosition(null);
      setCommands([]);
      return;
    }

    const docSize = view.state.doc.content.size;
    const clampPos = (pos: number) => {
      if (pos < 0) return 0;
      if (pos > docSize) return docSize;
      return pos;
    };

    const filteredCommands = Commands.filter((command) => {
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

    if (filteredCommands.length || isOnlyMetricNode) {
      let { from, to } = state.selection;
      // For metric nodes, use the node position for positioning
      if (isOnlyMetricNode && selectedMetric) {
        from = selectedMetric.pos;
        to = selectedMetric.pos + selectedMetric.node.nodeSize;
      }
      from = clampPos(from);
      to = clampPos(to);

      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      // Convert to viewport coordinates for portal positioning
      const left = Math.max((start.left + end.left) / 2, start.left + 3);
      const bottom = window.innerHeight - start.top + 5;

      setPosition({
        // eslint-disable-next-line i18next/no-literal-string
        left: `${left}px`,
        // eslint-disable-next-line i18next/no-literal-string
        bottom: `${bottom}px`,
      });
      setCommands(filteredCommands);
    } else {
      setPosition(null);
      setCommands([]);
    }
  }, [view, state, schema, isOnlyMetricNode, selectedMetric]);

  // Calculate position when selection or state changes
  useEffect(() => {
    calculatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    view,
    state?.selection.from,
    state?.selection.to,
    isOnlyMetricNode,
    selectedMetric?.pos,
  ]);

  // Update position on scroll and resize
  useEffect(() => {
    if (!position) return;

    const handleScroll = () => {
      calculatePosition();
    };

    const handleResize = () => {
      calculatePosition();
    };

    // Use capture phase to catch scroll events from all elements
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // Update active marks when state changes
  useEffect(() => {
    if (state) {
      setActiveMarks(
        getActiveMarks(state, [schema.marks.strong, schema.marks.em])
      );
    }
  }, [state, schema]);

  const updateMetricNode = useCallback(
    (attrs: Record<string, any>) => {
      if (!view) return;

      // Get the current state from the view to ensure we have the latest
      const currentState = view.state;
      const currentSelectedMetric = getSelectedMetricNode(currentState, schema);

      if (!currentSelectedMetric) return;

      const { node, pos } = currentSelectedMetric;
      const { from, to } = currentState.selection;

      const tr = currentState.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...attrs,
        componentSettings: {
          ...node.attrs.componentSettings,
          ...attrs.componentSettings,
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
        tr.setSelection(currentState.selection);
      }

      view.dispatch(tr);
    },
    [view, schema]
  );

  const tooltipContent =
    commands.length > 0 || isOnlyMetricNode ? (
      <AnimatePresence>
        {position && (
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
            className={`bg-black text-white rounded shadow-sm fixed z-[9999] ${
              isOnlyMetricNode ? "flex-col" : "flex overflow-hidden"
            }`}
            style={{
              left: position.left,
              bottom: position.bottom,
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
                  <ReportWidgetTooltipControlsRouter
                    node={selectedMetric.node}
                    onUpdate={updateMetricNode}
                  />
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    ) : null;

  // Render in portal to avoid overflow clipping
  return typeof document !== "undefined"
    ? createPortal(tooltipContent, document.body)
    : null;
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
      const parseDOM = schema.spec.nodes.get("heading")?.parseDOM;
      let disable = true;
      if (parseDOM && Array.isArray(parseDOM)) {
        parseDOM.forEach((p) => {
          if (p.tag === "h1") {
            disable = false;
          }
        });
      }
      return (
        !setBlockType(schema.nodes.heading, { level: 1 })(state) || disable
      );
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

export type ReportWidgetTooltipControlsProps = {
  node: Node;
  /**
   * Update the metric node with arbitrary component-specific attributes.
   */
  onUpdate: (attrs: Record<string, any>) => void;
};

export type ReportWidgetTooltipControls = FC<ReportWidgetTooltipControlsProps>;
