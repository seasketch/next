import {
  claimReportStyle,
  releaseReportStyle,
  resetReportStyleClaims,
} from "./reportStyleClaims";

describe("reportStyleClaims", () => {
  beforeEach(() => {
    resetReportStyleClaims();
  });

  it("hides the style that was already showing", () => {
    const hideA = jest.fn();
    const hideB = jest.fn();
    claimReportStyle("a", hideA);
    claimReportStyle("b", hideB);
    expect(hideA).toHaveBeenCalledTimes(1);
    expect(hideB).not.toHaveBeenCalled();
  });

  it("does not hide a style that claims again", () => {
    const hideA = jest.fn();
    claimReportStyle("a", hideA);
    claimReportStyle("a", hideA);
    expect(hideA).not.toHaveBeenCalled();
  });

  it("lets the next claim proceed after the active one releases", () => {
    const hideA = jest.fn();
    const hideB = jest.fn();
    claimReportStyle("a", hideA);
    releaseReportStyle("a");
    claimReportStyle("b", hideB);
    expect(hideA).not.toHaveBeenCalled();
    expect(hideB).not.toHaveBeenCalled();
  });

  it("ignores a release from a style that is not showing", () => {
    const hideA = jest.fn();
    const hideB = jest.fn();
    claimReportStyle("a", hideA);
    releaseReportStyle("b");
    claimReportStyle("c", hideB);
    expect(hideA).toHaveBeenCalledTimes(1);
  });
});
