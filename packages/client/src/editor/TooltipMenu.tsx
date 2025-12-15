import { LinkIcon } from "@heroicons/react/outline";
import { AnimatePresence, motion } from "framer-motion";
import { lift, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
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
import { TFunction, Trans, useTranslation } from "react-i18next";
import { getActiveMarks } from "./EditorMenuBar";
import { ReportWidgetTooltipControlsRouter } from "../reports/widgets/widgets";
import { formElements } from "./config";
import {
  FontBoldIcon,
  FontItalicIcon,
  HeadingIcon,
  ListBulletIcon,
  PilcrowIcon,
  UnderlineIcon,
} from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

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
  const blockMetricNodeType = schema.nodes.blockMetric;
  if (!blockMetricNodeType) {
    return false;
  }

  const { from, to } = state.selection;

  // first, check for a block metric node
  let nodeAtFrom = state.doc.nodeAt(from);
  if (
    nodeAtFrom &&
    nodeAtFrom.type === blockMetricNodeType &&
    to <= from + nodeAtFrom.nodeSize
  ) {
    return true;
  }

  // Check if the selection spans exactly one node and it's a metric node
  nodeAtFrom = state.doc.nodeAt(from);
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
  const blockMetricNodeType = schema.nodes.blockMetric;
  if (!blockMetricNodeType) {
    return null;
  }

  const { from, to } = state.selection;

  // Check if the selection spans exactly one node and it's a metric node
  let nodeAtFrom = state.doc.nodeAt(from);
  if (
    nodeAtFrom &&
    (nodeAtFrom.type === metricNodeType ||
      nodeAtFrom.type === blockMetricNodeType)
  ) {
    const nodeEnd = from + nodeAtFrom.nodeSize;
    if (to <= nodeEnd) {
      return { node: nodeAtFrom, pos: from };
    }
  }

  // Also check if selection starts right before a metric node and spans only that node
  const $from = state.doc.resolve(from);
  const nodeAfter = $from.nodeAfter;
  if (
    nodeAfter &&
    (nodeAfter.type === metricNodeType ||
      nodeAfter.type === blockMetricNodeType)
  ) {
    const nodeEnd = from + nodeAfter.nodeSize;
    if (to === nodeEnd) {
      return { node: nodeAfter, pos: from };
    }
  }
  return null;
}

function getActiveNodeTypeId(state: EditorState, schema: Schema): string {
  const { nodes } = schema;
  const $from = state.selection.$from;

  const matchNode = (nodeType?: any) => {
    if (!nodeType) return null;
    for (let depth = $from.depth; depth >= 0; depth--) {
      const node = $from.node(depth);
      if (node.type === nodeType) return node;
    }
    return null;
  };

  // Check explicit heading first
  const headingNode =
    matchNode(nodes.heading) ||
    matchNode(nodes.h1) ||
    matchNode(nodes.h2) ||
    matchNode(nodes.h3);
  if (headingNode) {
    const level = headingNode.attrs?.level ?? 1;
    if (level === 1) return "h1";
    if (level === 2) return "h2";
    if (level === 3) return "h3";
  }

  if (matchNode(nodes.h2)) return "h2b";
  if (matchNode(nodes.blockquote)) return "blockquote";
  if (matchNode(nodes.bullet_list)) return "bullet-list";
  if (matchNode(nodes.ordered_list)) return "ordered-list";
  if (matchNode(nodes.paragraph)) return "paragraph";

  return "paragraph";
}

function selectionIsReportTitle(state?: EditorState, schema?: Schema): boolean {
  if (!state || !schema) return false;
  const reportTitle = schema.nodes.reportTitle;
  if (!reportTitle) return false;
  const $from = state.selection.$from;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type === reportTitle) return true;
  }
  return false;
}

function selectionIsSurveyQuestion(
  state?: EditorState,
  schema?: Schema
): boolean {
  if (!state || !schema) return false;
  // questions schema uses node type "question" based on config
  const questionNode = (schema.nodes as any).question;
  if (!questionNode) return false;
  const $from = state.selection.$from;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type === questionNode) return true;
  }
  return false;
}

function nodeTypeSupported(schema: Schema, id: string): boolean {
  const n = schema.nodes;
  const isReportCardSchema = !!n.reportTitle;
  switch (id) {
    case "paragraph":
      return !!n.paragraph;
    case "blockquote":
      return !!n.blockquote;
    case "h1":
      if (isReportCardSchema) return false; // report body reserves h1 for reportTitle
      return !!n.heading || !!n.h1;
    case "h2":
    case "h3":
      return !!n.heading || !!(id === "h2" && n.h2) || !!(id === "h3" && n.h3);
    case "h2b":
      if (isReportCardSchema) return false;
      return !!n.h2 || !!n.heading;
    case "bullet-list":
      return !!n.bullet_list;
    case "ordered-list":
      return !!n.ordered_list;
    default:
      return false;
  }
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
  const [suppressOnce, setSuppressOnce] = useState(false);

  // Memoize these to prevent infinite loops
  const selectedMetric = useMemo(
    () => (state ? getSelectedMetricNode(state, schema) : null),
    [state, schema]
  );
  const isOnlyMetricNode = useMemo(
    () => (state ? selectionIsOnlyMetricNode(state, schema) : false),
    [state, schema]
  );

  const isReportSchema = (schema as any).isReportCardBodySchema;
  const isSurveyQuestionSchema = schema === formElements.questions.schema;
  // Calculate position function
  const calculatePosition = useCallback(() => {
    if (suppressOnce) {
      setPosition(null);
      setCommands([]);
      return;
    }
    if (!view || !state?.selection) {
      setPosition(null);
      setCommands([]);
      return;
    }

    // Only show when there is a non-empty selection, or a metric node is selected
    if (state.selection.empty && !isOnlyMetricNode) {
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
          command.id === "h3" ||
          command.id === "blockquote" ||
          command.id === "bullet-list" ||
          command.id === "ordered-list")
      ) {
        return false;
      }
      return !command.isDisabled(schema, state);
    });

    if (filteredCommands.length || isOnlyMetricNode) {
      let { from, to } = state.selection;

      // For metric nodes, position relative to the node DOM to better handle
      // block metrics that span the full width.
      if (isOnlyMetricNode && selectedMetric) {
        const dom = view.nodeDOM(selectedMetric.pos) as HTMLElement | null;
        if (dom) {
          const rect = dom.getBoundingClientRect();
          setPosition({
            // eslint-disable-next-line i18next/no-literal-string
            left: `${rect.left + rect.width / 2}px`,
            // eslint-disable-next-line i18next/no-literal-string
            bottom: `${window.innerHeight - rect.top + 5}px`,
          });
          setCommands(filteredCommands);
          return;
        }
        from = selectedMetric.pos;
        to = selectedMetric.pos + selectedMetric.node.nodeSize;
      }

      from = clampPos(from);
      to = clampPos(to);

      // Hack to support livereload. Otherwise an exception will
      // get thrown when developing.
      if (!("docView" in view)) {
        setPosition(null);
        setCommands([]);
        return;
      }

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

  // Clear suppression after a real selection change so tooltip can show again.
  useEffect(() => {
    if (suppressOnce) {
      setSuppressOnce(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.selection.from, state?.selection.to]);

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
      const marksToCheck = [
        schema.marks.strong,
        schema.marks.em,
        schema.marks.underline,
      ].filter(Boolean);
      setActiveMarks(getActiveMarks(state, marksToCheck as any));
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
      if (
        newMetricNode &&
        (newMetricNode.type === schema.nodes.metric ||
          newMetricNode.type === schema.nodes.blockMetric)
      ) {
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

  const markCommands = useMemo(
    () => commands.filter((c) => c.group === "mark"),
    [commands]
  );

  const nodeTypeOptions = useMemo(() => {
    if (!state) return [];
    return Commands.filter(
      (c) => c.group === "node-type" && nodeTypeSupported(schema, c.id)
    );
  }, [state, schema]);

  const currentNodeTypeId = useMemo(() => {
    if (!state) return "paragraph";
    return getActiveNodeTypeId(state, schema);
  }, [state, schema]);

  const currentNodeTitle =
    nodeTypeOptions.find((c) => c.id === currentNodeTypeId)?.title ||
    "Paragraph";

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
            data-report-tooltip="true"
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
            {(commands.length > 0 || (isOnlyMetricNode && selectedMetric)) && (
              <div className="flex overflow-hidden items-center">
                {nodeTypeOptions.length > 0 &&
                  !selectionIsReportTitle(state, schema) &&
                  !(
                    isSurveyQuestionSchema &&
                    selectionIsSurveyQuestion(state, schema)
                  ) &&
                  // Hide for block metrics; allow inline metrics to format parent block
                  !(
                    isOnlyMetricNode &&
                    selectedMetric?.node?.type === schema.nodes.blockMetric
                  ) && (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          className="h-8 bg-gray-900 text-white text-sm px-2 border border-gray-800 rounded-sm mr-1 inline-flex items-center gap-1"
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <PilcrowIcon />
                          <span>{currentNodeTitle}</span>
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="bg-gray-900 text-white border border-gray-800 rounded shadow-lg px-1 py-1"
                          sideOffset={4}
                        >
                          <DropdownMenu.Label className="px-2 py-1 text-xs text-gray-300">
                            <Trans ns="admin:reports">Change to</Trans>
                          </DropdownMenu.Label>
                          <DropdownMenu.Separator className="h-px bg-gray-800 my-1" />
                          {nodeTypeOptions.map((command) => (
                            <DropdownMenu.Item
                              key={command.id}
                              className="px-2 py-1 text-sm flex items-center gap-2 rounded hover:bg-gray-800 focus:bg-gray-800 outline-none cursor-pointer"
                              onSelect={(e: Event) => {
                                e.preventDefault();
                                if (!view || !state) return;
                                const targetId = command.id;

                                let workingState = view.state;
                                const dispatch = view.dispatch.bind(view);

                                // If selection is an inline metric, shift selection to its parent block
                                if (
                                  isOnlyMetricNode &&
                                  selectedMetric &&
                                  selectedMetric.node.type !==
                                    schema.nodes.blockMetric
                                ) {
                                  const $pos = workingState.doc.resolve(
                                    selectedMetric.pos
                                  );
                                  const blockStart = $pos.start($pos.depth);
                                  const blockEnd = $pos.end($pos.depth);
                                  const blockSelection = TextSelection.create(
                                    workingState.doc,
                                    blockStart + 1,
                                    Math.max(blockStart + 1, blockEnd - 1)
                                  );
                                  const trSel =
                                    workingState.tr.setSelection(
                                      blockSelection
                                    );
                                  dispatch(trSel);
                                  workingState = view.state;
                                }

                                const runLift = () => {
                                  // Keep lifting until nothing to lift
                                  while (lift(workingState, dispatch)) {
                                    workingState = view.state;
                                  }
                                };

                                const normalizeToParagraph = () => {
                                  const para =
                                    workingState.schema.nodes.paragraph;
                                  if (para) {
                                    setBlockType(para)(workingState, dispatch);
                                    workingState = view.state;
                                  }
                                };

                                const applyHeading = (level: number) => {
                                  const heading =
                                    workingState.schema.nodes.heading;
                                  if (heading) {
                                    setBlockType(heading, { level })(
                                      workingState,
                                      dispatch
                                    );
                                    workingState = view.state;
                                  }
                                };

                                // Always clear existing structural wrappers first
                                runLift();
                                normalizeToParagraph();

                                switch (targetId) {
                                  case "paragraph":
                                    break;
                                  case "blockquote": {
                                    const blockquote =
                                      workingState.schema.nodes.blockquote;
                                    if (blockquote) {
                                      wrapIn(blockquote)(
                                        workingState,
                                        dispatch
                                      );
                                      workingState = view.state;
                                    }
                                    break;
                                  }
                                  case "bullet-list": {
                                    const list =
                                      workingState.schema.nodes.bullet_list;
                                    if (list) {
                                      wrapInList(list)(workingState, dispatch);
                                      workingState = view.state;
                                    }
                                    break;
                                  }
                                  case "ordered-list": {
                                    const list =
                                      workingState.schema.nodes.ordered_list;
                                    if (list) {
                                      wrapInList(list)(workingState, dispatch);
                                      workingState = view.state;
                                    }
                                    break;
                                  }
                                  case "h1":
                                    applyHeading(1);
                                    break;
                                  case "h2":
                                    applyHeading(2);
                                    break;
                                  case "h3":
                                    applyHeading(3);
                                    break;
                                  case "h2b": {
                                    const h2 = workingState.schema.nodes.h2;
                                    if (h2) {
                                      setBlockType(h2)(workingState, dispatch);
                                      workingState = view.state;
                                    } else {
                                      applyHeading(2);
                                    }
                                    break;
                                  }
                                  default:
                                    break;
                                }

                                // Return focus to the editor so keyboard shortcuts (e.g., undo)
                                // keep working after interacting with the dropdown.
                                view.focus();
                                requestAnimationFrame(() => view.focus());

                                // Hide the tooltip after changing node type (Notion/tiptap behavior)
                                setCommands([]);
                                setSuppressOnce(true);
                                // Allow reopening shortly after by clearing suppression on next tick
                                setTimeout(() => setSuppressOnce(false), 0);
                              }}
                            >
                              <span className="flex items-center gap-2">
                                {command.icon}
                                <span>{command.title}</span>
                              </span>
                            </DropdownMenu.Item>
                          ))}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )}
                {markCommands.map((c) => (
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
  title: string;
  group?: "node-type" | "mark";
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
    icon: <FontBoldIcon />,
    title: "Bold",
    group: "mark",
    isDisabled: (schema, state) => !toggleMark(schema.marks.strong)(state),
    toggle: (schema, state, dispatch) => {
      toggleMark(schema.marks.strong)(state, dispatch);
    },
  },
  {
    id: "em",
    title: "Italic",
    group: "mark",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <FontItalicIcon />,
    isDisabled: (schema, state) => !toggleMark(schema.marks.em)(state),
    toggle: (schema, state, dispatch) => {
      toggleMark(schema.marks.em)(state, dispatch);
    },
  },
  {
    id: "underline",
    title: "Underline",
    group: "mark",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <UnderlineIcon />,
    isDisabled: (schema, state) => {
      const underline = schema.marks.underline;
      return !underline || !toggleMark(underline)(state);
    },
    toggle: (schema, state, dispatch) => {
      const underline = schema.marks.underline;
      if (underline) {
        toggleMark(underline)(state, dispatch);
      }
    },
  },
  {
    id: "link",
    title: "Link",
    group: "mark",
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
    title: "Paragraph",
    group: "node-type",
    icon: <PilcrowIcon />,
    isDisabled: (schema, state) => {
      console.log(schema.spec.nodes);

      return !setBlockType(schema.nodes.paragraph)(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.paragraph)(state, dispatch);
    },
  },
  {
    id: "blockquote",
    title: "Blockquote",
    group: "node-type",
    icon: "“",
    isDisabled: (schema, state) => {
      return !wrapIn(schema.nodes.blockquote)(state);
    },
    toggle: (schema, state, dispatch) => {
      wrapIn(schema.nodes.blockquote)(state, dispatch);
    },
  },
  {
    id: "h1",
    title: "Heading 1",
    group: "node-type",
    icon: <HeadingIcon />,
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
    title: "Heading 2",
    group: "node-type",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <HeadingIcon />,
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 2 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 2 })(state, dispatch);
    },
  },
  {
    id: "h2b",
    title: "Heading",
    group: "node-type",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <HeadingIcon />,
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.h2)(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.h2)(state, dispatch);
    },
  },
  {
    id: "h3",
    title: "Heading 3",
    group: "node-type",
    icon: <HeadingIcon />,
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 3 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 3 })(state, dispatch);
    },
  },
  {
    id: "bullet-list",
    title: "List",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <ListBulletIcon />,
    group: "node-type",
    isDisabled: (schema, state) => {
      return !wrapInList(schema.nodes.bullet_list)(state);
    },
    toggle: (schema, state, dispatch) => {
      wrapInList(schema.nodes.bullet_list)(state, dispatch);
    },
  },
  {
    id: "ordered-list",
    title: "Ordered List",
    // eslint-disable-next-line i18next/no-literal-string
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="size-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 1 1 1.591 1.59l-1.83 1.83h2.16M2.99 15.745h1.125a1.125 1.125 0 0 1 0 2.25H3.74m0-.002h.375a1.125 1.125 0 0 1 0 2.25H2.99"
        />
      </svg>
    ),
    group: "node-type",
    isDisabled: (schema, state) => {
      return !wrapInList(schema.nodes.ordered_list)(state);
    },
    toggle: (schema, state, dispatch) => {
      wrapInList(schema.nodes.ordered_list)(state, dispatch);
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
