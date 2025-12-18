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
  MouseEvent as ReactMouseEvent,
  useRef,
  Fragment,
} from "react";
import { createPortal } from "react-dom";
import { TFunction, useTranslation } from "react-i18next";
import { getActiveMarks } from "./EditorMenuBar";
import { ReportWidgetTooltipControlsRouter } from "../reports/widgets/widgets";
import { formElements } from "./config";
import {
  CaretDownIcon,
  FontBoldIcon,
  FontItalicIcon,
  HeadingIcon,
  ListBulletIcon,
  TextIcon,
  TrashIcon,
  UnderlineIcon,
} from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";

/**
 * Check if the selection is exclusively a metric node (no other content)
 */
const ICON_CONTAINER_CLASSES =
  "flex items-center justify-center w-4 h-4 overflow-hidden";
const ICON_TOGGLE_BUTTON_CLASSES =
  "w-7 h-7 inline-flex items-center justify-center rounded border border-transparent hover:bg-gray-100 focus:outline-none active:bg-gray-100";
const DROPDOWN_TRIGGER_CLASSES =
  "h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none";

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
  if (matchNode(nodes.resultsParagraph)) return "results-paragraph";
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
    // case "blockquote":
    //   return !!n.blockquote;
    case "details":
      return !!n.details && !!n.summary;
    case "results-paragraph":
      return !!n.resultsParagraph;
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

function getActiveLinkRange(
  state: EditorState
): { from: number; to: number } | null {
  const link = state.schema.marks.link;
  if (!link) return null;
  const { selection } = state;
  const { from, to } = selection;
  const hasLink = (pos: number) =>
    state.doc
      .resolve(pos)
      .marks()
      .some((m) => m.type === link);
  const linkExists =
    state.doc.rangeHasMark(from, to, link) || hasLink(from) || hasLink(to);
  if (!linkExists) return null;

  const clamp = (pos: number) =>
    Math.max(0, Math.min(pos, state.doc.content.size));

  let start = from;
  let end = to;
  // Expand start to include the full link mark
  while (start > 0 && hasLink(start - 1)) {
    start--;
  }
  // Expand end to include the full link mark
  while (end < state.doc.content.size && hasLink(end)) {
    end++;
  }

  return { from: clamp(start), to: clamp(end) };
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
  const { t } = useTranslation("admin:reports");
  const [position, setPosition] = useState<{
    left: string;
    bottom: string;
  } | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [activeMarks, setActiveMarks] = useState<{ [id: string]: boolean }>({});
  const [suppressOnce, setSuppressOnce] = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkPopoverPos, setLinkPopoverPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const linkTriggerRef = useRef<HTMLButtonElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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
      if (command.id === "h2b") {
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
      let start: any;
      let end: any;

      try {
        start = view.coordsAtPos(from);
        end = view.coordsAtPos(to);
      } catch (e) {
        // Hack to support livereload. Otherwise an exception will
        // get thrown when developing.
        return;
      }

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

  // If tooltip hides, also clear any lingering link popover state.
  useEffect(() => {
    if (position) return;
    setLinkPopoverOpen(false);
    setLinkPopoverPos(null);
  }, [position]);

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
        schema.marks.link,
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

  const activeLinkMark = useMemo(() => {
    if (!state || !state.selection || state.selection.empty) return null;
    const links = getActiveLinks(state) || [];
    return links.length ? links[0] : null;
  }, [state]);

  const calculateLinkPopoverPosition = useCallback(() => {
    const trigger = linkTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 300;
    const padding = 8;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, padding),
      window.innerWidth - width - padding
    );
    const top = rect.top - 8; // position above the trigger
    setLinkPopoverPos({ left, top });
  }, []);

  const updateLinkPopoverPosition = useCallback(() => {
    if (linkPopoverOpen) {
      calculateLinkPopoverPosition();
    }
  }, [calculateLinkPopoverPosition, linkPopoverOpen]);

  useEffect(() => {
    if (linkPopoverOpen) {
      setLinkUrl(activeLinkMark?.attrs?.href || "");
      setLinkTitle(activeLinkMark?.attrs?.title || "");
      setLinkError(null);
      updateLinkPopoverPosition();
      requestAnimationFrame(() => {
        linkInputRef.current?.focus();
      });
      const handler = () => updateLinkPopoverPosition();
      window.addEventListener("scroll", handler, true);
      window.addEventListener("resize", handler);
      return () => {
        window.removeEventListener("scroll", handler, true);
        window.removeEventListener("resize", handler);
      };
    }
  }, [linkPopoverOpen, activeLinkMark, updateLinkPopoverPosition]);

  useEffect(() => {
    if (!view?.dom) {
      return;
    }
    const handler = (e: MouseEvent) => {
      const path = (e.composedPath?.() || []) as Array<EventTarget>;
      const inEditor = path.some(
        (node) => node instanceof HTMLElement && view.dom.contains(node)
      );
      if (inEditor) return;
      const inTooltip = path.some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const ds = node.dataset;
        return (
          ds?.reportTooltip === "true" ||
          ds?.reportTooltipPortal === "true" ||
          ds?.inlineLinkPopover === "true" ||
          ds?.tooltipDropdown === "true" ||
          ds?.tooltipPortal === "true" ||
          ds?.reportCommandPalette === "true" ||
          ds?.reportBlockHandle === "true"
        );
      });
      if (inTooltip) return;

      // check for closing of radix dropdown
      if (e.target instanceof HTMLElement && e.target.tagName === "HTML") {
        // const body = document.body;
        // if (body.style.pointerEvents === "none") {
        return;
        // }
      }

      // clear editor selection
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 0, 0))
      );
      // setPosition(null);
      // setCommands([]);
      // setLinkPopoverOpen(false);
      // setLinkPopoverPos(null);
    };

    window.document.addEventListener("mousedown", handler, true);
    return () => {
      window.document.removeEventListener("mousedown", handler, true);
    };
  }, [view?.dom]);

  // Close tooltip/popovers when clicking outside the editor/tooltip
  // useEffect(() => {
  //   if (!position || !view?.dom) return;
  //   const viewDom = view.dom as HTMLElement;
  //   const handler = (e: Event) => {
  //     const path = (e.composedPath?.() || []) as Array<EventTarget>;
  //     const inEditor = path.some(
  //       (node) => node instanceof HTMLElement && viewDom.contains(node)
  //     );
  //     if (inEditor) return;

  //     const inTooltip = path.some((node) => {
  //       if (!(node instanceof HTMLElement)) return false;
  //       const ds = node.dataset;
  //       return (
  //         ds?.reportTooltip === "true" ||
  //         ds?.reportTooltipPortal === "true" ||
  //         ds?.inlineLinkPopover === "true"
  //       );
  //     });
  //     if (inTooltip) return;

  //     setPosition(null);
  //     setCommands([]);
  //     setLinkPopoverOpen(false);
  //     setLinkPopoverPos(null);
  //   };
  //   document.addEventListener("mousedown", handler, true);
  //   return () => {
  //     document.removeEventListener("mousedown", handler, true);
  //   };
  // }, [position, view]);

  // Close link popover when selection moves
  useEffect(() => {
    setLinkPopoverOpen(false);
    setLinkPopoverPos(null);
  }, [state?.selection.from, state?.selection.to]);

  const applyLink = useCallback(() => {
    if (!view || !state) return;
    const href = linkUrl.trim();
    const title = linkTitle.trim();
    const linkMark = schema.marks.link;
    if (!linkMark) return;

    const range = getActiveLinkRange(state) || {
      from: state.selection.from,
      to: state.selection.to,
    };

    const tr = state.tr.removeMark(range.from, range.to, linkMark);

    if (href) {
      const valid = /^https?:\/\//i.test(href) || /^mailto:/i.test(href);
      if (!valid) {
        // eslint-disable-next-line i18next/no-literal-string
        setLinkError(
          "Please enter a valid link starting with http://, https://, or mailto:"
        );
        return;
      }
      setLinkError(null);
      tr.addMark(
        range.from,
        range.to,
        linkMark.create(title ? { href, title } : { href })
      );
    }

    view.dispatch(tr);
    setLinkPopoverOpen(false);
    setLinkPopoverPos(null);
    requestAnimationFrame(() => view.focus());
  }, [linkUrl, linkTitle, schema.marks.link, state, view]);

  const removeLink = useCallback(() => {
    if (!view || !state) return;
    toggleMark(schema.marks.link, { href: null })(state, view.dispatch);
    setLinkPopoverOpen(false);
    setLinkPopoverPos(null);
    requestAnimationFrame(() => view.focus());
  }, [schema.marks.link, state, view]);

  const markCommands = useMemo(
    () => commands.filter((c) => c.group === "mark"),
    [commands]
  );

  const handleNodeTypeChange = useCallback(
    (targetId: string) => {
      if (!view || !state) return;

      let workingState = view.state;
      const dispatch = view.dispatch.bind(view);

      // If selection is an inline metric, shift selection to its parent block
      if (
        isOnlyMetricNode &&
        selectedMetric &&
        selectedMetric.node.type !== schema.nodes.blockMetric
      ) {
        const $pos = workingState.doc.resolve(selectedMetric.pos);
        const blockStart = $pos.start($pos.depth);
        const blockEnd = $pos.end($pos.depth);
        const blockSelection = TextSelection.create(
          workingState.doc,
          blockStart + 1,
          Math.max(blockStart + 1, blockEnd - 1)
        );
        const trSel = workingState.tr.setSelection(blockSelection);
        dispatch(trSel);
        workingState = view.state;
      }

      const convertExistingList = (target: string) => {
        if (target !== "bullet-list" && target !== "ordered-list") return false;
        const { bullet_list, ordered_list } = workingState.schema.nodes;
        const { $from, $to } = workingState.selection;

        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type !== bullet_list && node.type !== ordered_list) continue;
          if ($to.depth < depth || $to.node(depth) !== node) continue;

          const pos = $from.before(depth);
          const targetType =
            target === "bullet-list" ? bullet_list : ordered_list;
          if (!targetType || node.type === targetType) return false;

          const targetAttrs =
            targetType === ordered_list ? node.attrs ?? {} : undefined;
          const tr = workingState.tr.setNodeMarkup(
            pos,
            targetType,
            targetAttrs
          );
          dispatch(tr);
          workingState = view.state;
          return true;
        }

        return false;
      };

      const runLift = () => {
        while (lift(workingState, dispatch)) {
          workingState = view.state;
        }
      };

      const normalizeToParagraph = () => {
        const para = workingState.schema.nodes.paragraph;
        if (para) {
          setBlockType(para)(workingState, dispatch);
          workingState = view.state;
        }
      };

      const applyHeading = (level: number) => {
        const heading = workingState.schema.nodes.heading;
        if (heading) {
          setBlockType(heading, { level })(workingState, dispatch);
          workingState = view.state;
        }
      };

      // Always clear existing structural wrappers first
      if (convertExistingList(targetId)) {
        view.focus();
        requestAnimationFrame(() => view.focus());
        setCommands([]);
        setSuppressOnce(true);
        setTimeout(() => setSuppressOnce(false), 0);
        return;
      }

      runLift();
      normalizeToParagraph();

      switch (targetId) {
        case "paragraph":
          break;
        case "blockquote": {
          const blockquote = workingState.schema.nodes.blockquote;
          if (blockquote) {
            wrapIn(blockquote)(workingState, dispatch);
            workingState = view.state;
          }
          break;
        }
        case "bullet-list": {
          const list = workingState.schema.nodes.bullet_list;
          if (list) {
            wrapInList(list)(workingState, dispatch);
            workingState = view.state;
          }
          break;
        }
        case "ordered-list": {
          const list = workingState.schema.nodes.ordered_list;
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
        case "details": {
          const detailsType = workingState.schema.nodes.details;
          const summaryType = workingState.schema.nodes.summary;
          const paragraphType = workingState.schema.nodes.paragraph;
          if (!detailsType || !summaryType || !paragraphType) break;

          const summary = summaryType.create(null, schema.text("Learn more"));

          const slice = workingState.selection.content();
          const contentNodes: Node[] = [];
          slice.content.forEach((n) => contentNodes.push(n));
          if (contentNodes.length === 0) {
            const para =
              paragraphType.createAndFill() || paragraphType.create();
            contentNodes.push(para);
          }

          const detailsNode = detailsType.create({ open: false }, [
            summary,
            ...contentNodes,
          ]);

          const tr = workingState.tr
            .replaceSelectionWith(detailsNode)
            .scrollIntoView();
          dispatch(tr);
          workingState = view.state;
          break;
        }
        case "results-paragraph": {
          const resultsParagraphType =
            workingState.schema.nodes.resultsParagraph;
          if (!resultsParagraphType) break;
          setBlockType(resultsParagraphType)(workingState, dispatch);
          workingState = view.state;
          break;
        }

        default:
          break;
      }

      view.focus();
      requestAnimationFrame(() => view.focus());

      // Hide the tooltip after changing node type (Notion/tiptap behavior)
      setCommands([]);
      setSuppressOnce(true);
      setTimeout(() => setSuppressOnce(false), 0);
    },
    [
      isOnlyMetricNode,
      schema.nodes.blockMetric,
      selectedMetric,
      setCommands,
      setSuppressOnce,
      state,
      view,
    ]
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

  const isQuestionsSchema = schema === formElements.questions.schema;

  const tooltipContent =
    commands.length > 0 || isOnlyMetricNode ? (
      <AnimatePresence>
        {position && (
          <motion.div
            ref={tooltipRef}
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
            className={`bg-white text-gray-900 border border-black/20 rounded-lg px-2 py-[3px] shadow-lg fixed z-[9999] ${
              isOnlyMetricNode ? "flex-col" : "flex overflow-hidden"
            }`}
            data-report-tooltip="true"
            style={{
              left: position.left,
              bottom: position.bottom,
              transform: "translateX(-50%)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            }}
            onMouseDown={(e) => {
              // Prevent editor from handling mouse events when interacting with tooltip
              if (isOnlyMetricNode) {
                e.stopPropagation();
              }
            }}
          >
            {(commands.length > 0 || (isOnlyMetricNode && selectedMetric)) && (
              <div className="flex overflow-hidden items-center space-x-1">
                {!isQuestionsSchema &&
                  nodeTypeOptions.length > 0 &&
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
                    <DropdownMenu.Root
                      onOpenChange={(open) => {
                        if (!open) {
                          // When closing via the trigger, return focus so the selection stays visible
                          // and recompute position while keeping the tooltip open.
                          if (view) {
                            requestAnimationFrame(() => {
                              view.focus();
                              calculatePosition();
                            });
                          }
                        }
                      }}
                    >
                      <TooltipDropdown
                        value={currentNodeTypeId}
                        options={nodeTypeOptions.map((command) => ({
                          value: command.id,
                          label: command.title,
                          icon: command.icon,
                        }))}
                        onChange={handleNodeTypeChange}
                        title={t("Turn into")}
                        onOpenChange={(open) => {
                          if (!open && view) {
                            requestAnimationFrame(() => {
                              view.focus();
                              calculatePosition();
                            });
                          }
                        }}
                        ariaLabel={t("Change block type", {
                          ns: "admin:reports",
                        })}
                        contentProps={
                          {
                            "data-report-tooltip-portal": "true",
                          } as any
                        }
                      />
                    </DropdownMenu.Root>
                  )}
                {markCommands.map((c) =>
                  c.id === "link" ? (
                    <Fragment key={c.id}>
                      <TooltipIconToggleButton
                        active={!!activeLinkMark}
                        buttonRef={linkTriggerRef}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLinkPopoverOpen((prev) => {
                            const next = !prev;
                            if (next) {
                              requestAnimationFrame(() => {
                                calculateLinkPopoverPosition();
                              });
                            }
                            return next;
                          });
                        }}
                        title={t("Link")}
                      >
                        {c.icon}
                      </TooltipIconToggleButton>
                      {linkPopoverOpen && linkPopoverPos && (
                        <InlinePopover
                          position={linkPopoverPos}
                          onClose={() => {
                            setLinkPopoverOpen(false);
                            setLinkPopoverPos(null);
                            requestAnimationFrame(() => view?.focus());
                          }}
                        >
                          <div
                            className="flex items-center gap-1"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <input
                              type="url"
                              value={linkUrl}
                              onChange={(e) => setLinkUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  applyLink();
                                }
                              }}
                              ref={linkInputRef}
                              className="flex-1 rounded border border-gray-300 px-2 py-0 text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={t("Paste or type a URL")}
                            />

                            <button
                              type="button"
                              className="text-[12px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                              onClick={(e) => {
                                e.preventDefault();
                                applyLink();
                              }}
                              title={t("Apply")}
                            >
                              {t("Apply")}{" "}
                              {
                                // eslint-disable-next-line i18next/no-literal-string
                                `↵`
                              }
                            </button>
                            {activeLinkMark && (
                              <button
                                type="button"
                                className="text-[12px] px-2 py-1 text-gray-700 hover:text-red-900"
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeLink();
                                }}
                                title={t("Clear")}
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                          {linkError && (
                            <div className="text-[11px] text-red-600 mt-1">
                              {linkError}
                            </div>
                          )}
                        </InlinePopover>
                      )}
                    </Fragment>
                  ) : (
                    <TooltipIconToggleButton
                      key={c.id}
                      active={!!activeMarks[c.id]}
                      onClick={(e) => {
                        c.toggle(schema, state!, view!.dispatch, t);
                        e.preventDefault();
                        return false;
                      }}
                      title={c.title}
                    >
                      {c.icon}
                    </TooltipIconToggleButton>
                  )
                )}
                {isOnlyMetricNode && selectedMetric && state && view && (
                  <>
                    {commands.length > 0 && (
                      <>
                        {/* <div className="h-6 w-px bg-gray-300 mx-0.5" /> */}
                        <div className="flex items-center gap-2 text-sm text-gray-800"></div>
                        {/* <div className="flex items-center gap-2 text-sm text-gray-800"></div> */}
                        {/* <div className="flex items-center gap-2 text-sm text-gray-800"></div> */}
                      </>
                    )}
                    <ReportWidgetTooltipControlsRouter
                      node={selectedMetric.node}
                      onUpdate={updateMetricNode}
                    />
                  </>
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
      const url = window.prompt(t("Enter a URL"), existingUrl);
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
    title: "Text",
    group: "node-type",
    icon: <TextIcon />,
    isDisabled: (schema, state) => !setBlockType(schema.nodes.paragraph)(state),
    toggle: (schema, state, dispatch) =>
      setBlockType(schema.nodes.paragraph)(state, dispatch),
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
  // {
  //   id: "h2b",
  //   title: "Heading",
  //   group: "node-type",
  //   // eslint-disable-next-line i18next/no-literal-string
  //   icon: <HeadingIcon />,
  //   isDisabled: (schema, state) => {
  //     return !setBlockType(schema.nodes.h2)(state);
  //   },
  //   toggle: (schema, state, dispatch) => {
  //     setBlockType(schema.nodes.h2)(state, dispatch);
  //   },
  // },
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
  {
    id: "details",
    title: "Collapsible block",
    group: "node-type",
    icon: <CaretDownIcon />,
    isDisabled: (schema, _state) =>
      !schema.nodes.details || !schema.nodes.summary,
    toggle: (schema, state, dispatch) => {
      // This is handled in handleNodeTypeChange; no-op here
      setBlockType(schema.nodes.paragraph)(state, dispatch);
    },
  },
  {
    id: "results-paragraph",
    title: "Results paragraph",
    group: "node-type",
    icon: <TextIcon />,
    isDisabled: (schema, state) =>
      !schema.nodes.resultsParagraph ||
      !setBlockType(schema.nodes.resultsParagraph)(state),
    toggle: (schema, state, dispatch) => {
      // This is handled in handleNodeTypeChange; no-op here
      setBlockType(schema.nodes.paragraph)(state, dispatch);
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

export type TooltipDropdownOption = {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  /**
   * When true, prevents the dropdown from closing on select.
   */
  preventCloseOnSelect?: boolean;
  /**
   * Optional className override for this item.
   */
  className?: string;
};

export function TooltipDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  onOpenChange,
  title,
  contentProps,
  getDisplayLabel,
}: {
  value: string;
  options: TooltipDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  onOpenChange?: (open: boolean) => void;
  title?: ReactNode;
  contentProps?: React.HTMLAttributes<HTMLDivElement>;
  getDisplayLabel?: (selected?: TooltipDropdownOption) => ReactNode;
}) {
  const selected = options.find((o) => o.value === value);
  const displayLabel = getDisplayLabel
    ? getDisplayLabel(selected)
    : selected?.label ?? value;
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          className={DROPDOWN_TRIGGER_CLASSES}
          type="button"
          aria-label={ariaLabel}
        >
          {selected?.icon && (
            <span className={ICON_CONTAINER_CLASSES}>{selected.icon}</span>
          )}
          <span>{displayLabel}</span>
          <span className={ICON_CONTAINER_CLASSES}>
            <CaretDownIcon />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          {...contentProps}
          className="bg-white text-gray-900 border border-black/20 rounded shadow-lg px-1 py-1 z-50"
          sideOffset={6}
          side="top"
          data-tooltip-dropdown="true"
        >
          {title && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-gray-600">
                {title}
              </div>
              {/* <DropdownMenu.Separator className="h-px bg-gray-200 my-1" /> */}
            </>
          )}
          {options.map((opt) => (
            <DropdownMenu.Item
              key={opt.value}
              className={
                opt.className ??
                `px-2 py-1 text-sm flex items-center gap-2 rounded hover:bg-gray-100 focus:bg-gray-100 outline-none cursor-pointer ${
                  opt.value === value ? "text-blue-600" : ""
                }`
              }
              onSelect={(e: Event) => {
                if (opt.preventCloseOnSelect) {
                  e.preventDefault();
                }
                onChange(opt.value);
              }}
            >
              {opt.icon ? (
                <span className="flex items-center gap-2">
                  <span className={ICON_CONTAINER_CLASSES}>{opt.icon}</span>
                  <span>{opt.label}</span>
                </span>
              ) : (
                opt.label
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function TooltipPopoverContent({
  children,
  side = "top",
  sideOffset = 6,
  align = "center",
  collisionPadding = 8,
  title,
}: {
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  align?: "start" | "center" | "end";
  collisionPadding?: number;
  title?: ReactNode;
}) {
  return (
    <Popover.Portal>
      <Popover.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        avoidCollisions
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="bg-white text-gray-900 border border-black/20 rounded-lg shadow-lg px-2 py-2 w-72 z-[10000]"
        data-tooltip-portal="true"
      >
        {title && (
          <div className="px-1 py-1 text-xs font-semibold text-gray-400">
            {title}
          </div>
        )}
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
}

export function TooltipIconToggleButton({
  active,
  onClick,
  children,
  title,
  buttonRef,
}: {
  active?: boolean;
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  title?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      title={title}
      ref={buttonRef}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={onClick}
      className={`${ICON_TOGGLE_BUTTON_CLASSES} ${
        active ? "text-blue-600 " : "text-gray-900"
      }`}
    >
      <span className={ICON_CONTAINER_CLASSES}>{children}</span>
    </button>
  );
}

function InlinePopover({
  position,
  children,
  onClose,
}: {
  position: { left: number; top: number };
  children: ReactNode;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed z-[10000]"
      style={{
        left: position.left,
        top: position.top,
        transform: "translate(-50%, -100%)",
      }}
      data-inline-link-popover="true"
      data-report-tooltip-portal="true"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-white text-gray-900 border border-black/20 rounded-lg shadow-lg px-2 py-2 w-72">
        {children}
      </div>
    </div>,
    document.body
  );
}

export type ReportWidgetTooltipControlsProps = {
  node: Node;
  /**
   * Update the metric node with arbitrary component-specific attributes.
   */
  onUpdate: (attrs: Record<string, any>) => void;
};

export type ReportWidgetTooltipControls = FC<ReportWidgetTooltipControlsProps>;
