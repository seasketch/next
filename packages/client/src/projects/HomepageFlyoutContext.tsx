import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/** Matches `Toolbar` motion.nav expand/collapse duration. */
export const HOMEPAGE_FLYOUT_MS = 150;
export const HOMEPAGE_FLYOUT_WIDTH = 384;
export const HOMEPAGE_TOOLBAR_WIDTH = 64;

export type HomepageFlyoutState = {
  /** Target open state of the homepage flyout (updates immediately). */
  open: boolean;
  /** Pixel width while open. 0 when closed. */
  width: number;
};

const DEFAULT_STATE: HomepageFlyoutState = { open: false, width: 0 };

const HomepageFlyoutStateContext =
  createContext<HomepageFlyoutState>(DEFAULT_STATE);
const HomepageFlyoutSetContext = createContext<
  (next: HomepageFlyoutState) => void
>(() => {});

export function HomepageFlyoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HomepageFlyoutState>(DEFAULT_STATE);
  const setFlyout = useCallback((next: HomepageFlyoutState) => {
    setState((prev) =>
      prev.open === next.open && prev.width === next.width ? prev : next
    );
  }, []);
  const value = useMemo(() => state, [state]);
  return (
    <HomepageFlyoutSetContext.Provider value={setFlyout}>
      <HomepageFlyoutStateContext.Provider value={value}>
        {children}
      </HomepageFlyoutStateContext.Provider>
    </HomepageFlyoutSetContext.Provider>
  );
}

export function useHomepageFlyoutState() {
  return useContext(HomepageFlyoutStateContext);
}

export function useSetHomepageFlyout() {
  return useContext(HomepageFlyoutSetContext);
}

/** Leading padding so TimeSlider controls sit after an overlay or flyout. */
export function timeSliderLeadingInset({
  overlayOpen,
  overlayWidth,
  flyoutOpen,
  flyoutWidth,
  gap = 16,
  toolbarWidth = HOMEPAGE_TOOLBAR_WIDTH,
}: {
  overlayOpen: boolean;
  overlayWidth: number;
  flyoutOpen: boolean;
  flyoutWidth: number;
  gap?: number;
  toolbarWidth?: number;
}): number {
  if (overlayOpen) {
    return overlayWidth + gap;
  }
  if (flyoutOpen && flyoutWidth > toolbarWidth) {
    return flyoutWidth - toolbarWidth + gap;
  }
  return 0;
}
