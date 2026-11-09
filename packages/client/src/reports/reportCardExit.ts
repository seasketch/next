/** Fade, scale, then collapse. Kept under 500ms. */
export const REPORT_CARD_EXIT_MS = 400;

export function reportCardExitDuration() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return 0;
  }
  return REPORT_CARD_EXIT_MS;
}

export function wait(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
