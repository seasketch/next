const TOOLTIP_CURSOR_GAP = 16;
const TOOLTIP_VIEW_MARGIN = 8;

/** Place a cursor-following tooltip so it stays on screen and off the pointer. */
export function placeMapTooltip(args: {
  cursorX: number;
  cursorY: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}): { left: number; top: number; origin: string } {
  const {
    cursorX,
    cursorY,
    width,
    height,
    viewportWidth,
    viewportHeight,
  } = args;
  let left = cursorX + TOOLTIP_CURSOR_GAP;
  let top = cursorY + TOOLTIP_CURSOR_GAP;
  let flipX = false;
  let flipY = false;
  if (left + width > viewportWidth - TOOLTIP_VIEW_MARGIN) {
    left = cursorX - TOOLTIP_CURSOR_GAP - width;
    flipX = true;
  }
  if (top + height > viewportHeight - TOOLTIP_VIEW_MARGIN) {
    top = cursorY - TOOLTIP_CURSOR_GAP - height;
    flipY = true;
  }
  const maxLeft = Math.max(
    TOOLTIP_VIEW_MARGIN,
    viewportWidth - TOOLTIP_VIEW_MARGIN - width
  );
  const maxTop = Math.max(
    TOOLTIP_VIEW_MARGIN,
    viewportHeight - TOOLTIP_VIEW_MARGIN - height
  );
  left = Math.min(Math.max(left, TOOLTIP_VIEW_MARGIN), maxLeft);
  top = Math.min(Math.max(top, TOOLTIP_VIEW_MARGIN), maxTop);
  const origin = `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}`;
  return { left, top, origin };
}
