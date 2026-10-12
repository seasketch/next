type ReportStyleClaim = {
  key: string;
  hide: () => void;
};

let activeClaim: ReportStyleClaim | null = null;

/**
 * One report style is shown on the project map at a time. Claiming a new key
 * hides the style that was up.
 */
export function claimReportStyle(key: string, hide: () => void) {
  if (activeClaim && activeClaim.key !== key) {
    const previous = activeClaim;
    activeClaim = { key, hide };
    previous.hide();
    return;
  }
  activeClaim = { key, hide };
}

export function releaseReportStyle(key: string) {
  if (activeClaim?.key === key) {
    activeClaim = null;
  }
}

export function resetReportStyleClaims() {
  activeClaim = null;
}
