import { EditorView } from "prosemirror-view";
import { TextSelection } from "prosemirror-state";
import { SlashCommandRange } from "./plugin";
import { MetricDependency } from "overlay-engine";

/**
 * Properties for creating a metric node.
 */
export interface MetricProperties {
  metrics: MetricDependency[];
  componentSettings: Record<string, any>;
}

/**
 * Insert a horizontal rule (divider) at the specified range.
 * Creates a new paragraph after the rule if needed.
 */
export function insertHorizontalRule(
  view: EditorView,
  range: SlashCommandRange
): boolean {
  const { state, dispatch } = view;
  const { schema } = state;
  const nodeType = schema.nodes.horizontal_rule;
  const paragraphType = schema.nodes.paragraph;
  if (!nodeType || !paragraphType) {
    return false;
  }

  const node = nodeType.create();
  let tr = state.tr.replaceRangeWith(range.from, range.to, node);
  const posAfter = range.from + node.nodeSize;
  const paragraphNeeded = (() => {
    try {
      const $pos = tr.doc.resolve(posAfter);
      return !$pos.nodeAfter || $pos.nodeAfter.type !== paragraphType;
    } catch (err) {
      return true;
    }
  })();

  if (paragraphNeeded) {
    tr = tr.insert(posAfter, paragraphType.create());
  }

  const selectionPos = Math.min(tr.doc.content.size, posAfter + 1);
  tr = tr.setSelection(
    TextSelection.near(tr.doc.resolve(selectionPos), 1 /* forward */)
  );

  dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Insert a blockquote at the specified range.
 * Creates a blockquote containing a paragraph and places the cursor inside.
 */
export function insertBlockquote(
  view: EditorView,
  range: SlashCommandRange
): boolean {
  const { state, dispatch } = view;
  const { schema } = state;
  const blockquoteType = schema.nodes.blockquote;
  const paragraphType = schema.nodes.paragraph;

  if (!blockquoteType || !paragraphType) {
    return false;
  }

  const paragraph = paragraphType.create();
  const blockquote = blockquoteType.create(null, paragraph);
  let tr = state.tr.replaceRangeWith(range.from, range.to, blockquote);
  const selection =
    TextSelection.findFrom(tr.doc.resolve(range.from + 1), 1) ||
    TextSelection.near(tr.doc.resolve(range.from + 1));

  tr = tr.setSelection(selection);
  dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Insert a metric node at the specified range.
 * @param properties - The metric properties (type, geography)
 */
export function insertMetric(
  view: EditorView,
  range: SlashCommandRange,
  properties: MetricProperties
): boolean {
  const { state, dispatch } = view;
  const { schema } = state;
  const metricType = schema.nodes.metric;

  if (!metricType) {
    return false;
  }

  const node = metricType.create({
    ...properties,
  });

  let tr = state.tr.replaceRangeWith(range.from, range.to, node);

  // Place cursor after the inserted node
  const posAfter = range.from + node.nodeSize;
  tr = tr.setSelection(
    TextSelection.near(tr.doc.resolve(posAfter), 1 /* forward */)
  );

  dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
