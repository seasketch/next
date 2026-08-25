import { timeSliderLeadingInset } from "./HomepageFlyoutContext";

describe("timeSliderLeadingInset", () => {
  it("uses the overlay sidebar width when that panel is open", () => {
    expect(
      timeSliderLeadingInset({
        overlayOpen: true,
        overlayWidth: 384,
        flyoutOpen: true,
        flyoutWidth: 384,
      })
    ).toBe(400);
  });

  it("insets past the flyout after subtracting the collapsed toolbar", () => {
    expect(
      timeSliderLeadingInset({
        overlayOpen: false,
        overlayWidth: 384,
        flyoutOpen: true,
        flyoutWidth: 384,
      })
    ).toBe(336);
  });

  it("does not inset when both chrome panels are closed", () => {
    expect(
      timeSliderLeadingInset({
        overlayOpen: false,
        overlayWidth: 384,
        flyoutOpen: false,
        flyoutWidth: 0,
      })
    ).toBe(0);
  });
});
