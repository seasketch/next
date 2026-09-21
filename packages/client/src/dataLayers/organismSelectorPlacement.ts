export const ORGANISM_SELECTOR_WIDTH_REM = 26;
export const ORGANISM_SELECTOR_GAP_PX = 6;
export const ORGANISM_SELECTOR_VIEWPORT_PADDING_PX = 8;

export type OrganismSelectorSide = "left" | "right";

export type ViewportRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type OrganismSelectorPlacement = {
  side: OrganismSelectorSide;
  top: number;
  left: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
};

/**
 * Place the organism panel beside its trigger.
 *
 * The side is whichever one can hold the preferred width without crossing a
 * viewport edge. When both can, the roomier side wins. When neither can, the
 * roomier side is still used and the panel width shrinks to fit.
 *
 * Vertically the panel is centered on the trigger. If that would put it
 * above the viewport, it is pinned to the top padding. If it would run past
 * the bottom, it shifts up, but never above that top padding. A panel taller
 * than the viewport is height-capped and pinned to the top.
 */
export function placeOrganismSelectorPanel({
  trigger,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
  gap = ORGANISM_SELECTOR_GAP_PX,
  padding = ORGANISM_SELECTOR_VIEWPORT_PADDING_PX,
}: {
  trigger: ViewportRect;
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  padding?: number;
}): OrganismSelectorPlacement {
  const spaceLeft = trigger.left - padding;
  const spaceRight = viewportWidth - trigger.right - padding;
  const needed = panelWidth + gap;
  const leftFits = spaceLeft >= needed;
  const rightFits = spaceRight >= needed;

  let side: OrganismSelectorSide;
  if (leftFits !== rightFits) {
    side = leftFits ? "left" : "right";
  } else {
    side = spaceLeft >= spaceRight ? "left" : "right";
  }

  const spaceOnSide = side === "left" ? spaceLeft : spaceRight;
  const maxWidth = Math.max(0, spaceOnSide - gap);
  const width = Math.min(Math.max(panelWidth, 0), maxWidth);
  const maxHeight = Math.max(0, viewportHeight - padding * 2);
  const height = Math.min(Math.max(panelHeight, 0), maxHeight);

  const triggerMidY = trigger.top + trigger.height / 2;
  let top = triggerMidY - height / 2;
  const minTop = padding;
  const maxTop = Math.max(padding, viewportHeight - padding - height);
  if (top < minTop) {
    top = minTop;
  } else if (top > maxTop) {
    top = maxTop;
  }

  const left =
    side === "left" ? trigger.left - gap - width : trigger.right + gap;

  return { side, top, left, width, height, maxWidth, maxHeight };
}
