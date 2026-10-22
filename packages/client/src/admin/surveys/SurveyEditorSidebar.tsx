import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import useLocalStorage from "../../useLocalStorage";

/** Current fixed sidebar width, Tailwind `w-56`. */
export const SURVEY_EDITOR_SIDEBAR_MIN_WIDTH = 224;

const STORAGE_KEY = "survey-editor-sidebar-width";

function sidebarBounds(groupWidth: number) {
  const min = Math.min(SURVEY_EDITOR_SIDEBAR_MIN_WIDTH, groupWidth);
  const max = Math.min(
    groupWidth,
    Math.max(min, window.innerWidth / 3)
  );
  return { min, max };
}

function clampWidth(width: number, groupWidth: number) {
  const { min, max } = sidebarBounds(groupWidth);
  if (!Number.isFinite(width)) {
    return min;
  }
  return Math.min(max, Math.max(min, width));
}

/**
 * Left column of the survey editor. Width is shared across projects and
 * restored from local storage. The narrowest width is the original sidebar;
 * the widest is one third of the screen.
 */
export default function SurveyEditorSidebar({
  sidebar,
  canvas,
}: {
  sidebar: ReactNode;
  canvas: ReactNode;
}) {
  const { t } = useTranslation("admin:surveys");
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<ImperativePanelHandle>(null);
  const groupWidthRef = useRef(0);
  const storedWidthRef = useRef(SURVEY_EDITOR_SIDEBAR_MIN_WIDTH);
  const draggingRef = useRef(false);
  const [groupWidth, setGroupWidth] = useState(0);
  const [storedWidth, setStoredWidth] = useLocalStorage<number>(
    STORAGE_KEY,
    SURVEY_EDITOR_SIDEBAR_MIN_WIDTH
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      setGroupWidth((prev) => (prev === next ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  groupWidthRef.current = groupWidth;
  storedWidthRef.current = storedWidth;

  useLayoutEffect(() => {
    if (!groupWidth || !panelRef.current || draggingRef.current) {
      return;
    }
    const next = (clampWidth(storedWidthRef.current, groupWidth) / groupWidth) * 100;
    if (Math.abs(panelRef.current.getSize() - next) < 0.5) {
      return;
    }
    panelRef.current.resize(next);
  }, [groupWidth]);

  const onResize = useCallback(
    (size: number) => {
      const width = groupWidthRef.current;
      if (!width) {
        return;
      }
      const next = Math.round(clampWidth((size / 100) * width, width));
      setStoredWidth((prev) => (prev === next ? prev : next));
    },
    [setStoredWidth]
  );

  const bounds = groupWidth > 0 ? sidebarBounds(groupWidth) : null;
  const width = bounds ? clampWidth(storedWidth, groupWidth) : 0;

  return (
    <div ref={containerRef} className="h-full min-w-0 flex-1">
      {bounds && (
        <PanelGroup className="h-full" direction="horizontal">
          <Panel
            ref={panelRef}
            id="survey-editor-sidebar"
            className="z-10 min-w-0 bg-white shadow"
            defaultSize={(width / groupWidth) * 100}
            minSize={(bounds.min / groupWidth) * 100}
            maxSize={(bounds.max / groupWidth) * 100}
            onResize={onResize}
          >
            <div className="flex h-full max-h-full min-h-full flex-col overflow-y-auto">
              {sidebar}
            </div>
          </Panel>
          <PanelResizeHandle
            aria-label={t("Resize sidebar")}
            className="z-20 w-1.5 shrink-0 cursor-col-resize bg-gray-200 outline-none hover:bg-primary-300 focus-visible:bg-primary-400"
            hitAreaMargins={{ coarse: 12, fine: 6 }}
            onDragging={(isDragging) => {
              draggingRef.current = isDragging;
            }}
          />
          <Panel className="min-w-0" id="survey-editor-canvas">
            {canvas}
          </Panel>
        </PanelGroup>
      )}
    </div>
  );
}
