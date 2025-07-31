import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useContext,
} from "react";
import { useTranslation } from "react-i18next";
import * as Tabs from "@radix-ui/react-tabs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useReportContext } from "./ReportContext";
import { Droppable } from "react-beautiful-dnd";
import { FormLanguageContext } from "../formElements/FormElement";

export function ReportTabs({
  enableDragDrop = false,
}: {
  enableDragDrop?: boolean;
}) {
  const { t } = useTranslation("admin:sketching");
  const { report, selectedTabId, setSelectedTabId, selectedForEditing } =
    useReportContext();
  const langContext = useContext(FormLanguageContext);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visibleTabs, setVisibleTabs] = useState<typeof report.tabs>([]);
  const [overflowTabs, setOverflowTabs] = useState<typeof report.tabs>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const sortedTabs = useMemo(
    () => [...(report.tabs || [])].sort((a, b) => a.position - b.position),
    [report.tabs]
  );

  // Helper function to get localized tab title
  const getLocalizedTabTitle = useCallback(
    (tab: (typeof report.tabs)[0]) => {
      if (langContext?.lang?.code !== "EN" && tab.alternateLanguageSettings) {
        const alternateSettings =
          tab.alternateLanguageSettings[langContext.lang.code];
        if (alternateSettings?.title) {
          return alternateSettings.title;
        }
      }
      return tab.title;
    },
    [langContext?.lang?.code]
  );

  // Check if selected tab is in overflow
  const selectedTab = report.tabs.find((tab) => tab.id === selectedTabId);
  const isSelectedTabInOverflow =
    selectedTab && !visibleTabs.some((tab) => tab.id === selectedTabId);

  const calculateVisibleTabsRef = useRef<() => void>();

  calculateVisibleTabsRef.current = () => {
    const currentSortedTabs = [...(report.tabs || [])].sort(
      (a, b) => a.position - b.position
    );

    if (!containerRef.current || currentSortedTabs.length === 0) {
      setVisibleTabs(currentSortedTabs);
      setOverflowTabs([]);
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    const moreTabWidth = 128; // Approximate width for "More ▼" tab
    const visible: typeof currentSortedTabs = [];
    const overflow: typeof currentSortedTabs = [];

    // First, try to fit all tabs without the "More" tab
    let availableWidth = containerWidth;
    let allTabsFit = true;

    for (const tab of currentSortedTabs) {
      // Estimate width based on localized title length
      const localizedTitle = getLocalizedTabTitle(tab);
      const estimatedWidth = Math.max(55, localizedTitle.length * 8 + 32); // Rough estimate
      if (availableWidth >= estimatedWidth) {
        visible.push(tab);
        availableWidth -= estimatedWidth;
      } else {
        allTabsFit = false;
        break;
      }
    }

    // If all tabs fit, show them all
    if (allTabsFit) {
      setVisibleTabs(currentSortedTabs);
      setOverflowTabs([]);
      return;
    }

    // If not all tabs fit, recalculate with space for "More" tab
    availableWidth = containerWidth - moreTabWidth;
    visible.length = 0; // Reset visible array

    let isOverflowed = false;
    for (const tab of currentSortedTabs) {
      const localizedTitle = getLocalizedTabTitle(tab);
      const estimatedWidth = Math.max(55, localizedTitle.length * 8 + 30);
      if (!isOverflowed && availableWidth >= estimatedWidth) {
        visible.push(tab);
        availableWidth -= estimatedWidth;
      } else {
        isOverflowed = true;
        overflow.push(tab);
      }
    }

    // Ensure at least one tab is always visible
    if (visible.length === 0 && currentSortedTabs.length > 0) {
      visible.push(currentSortedTabs[0]);
      overflow.splice(0, 1);
    }

    setVisibleTabs(visible);
    setOverflowTabs(overflow);
  };

  // Calculate visible tabs when tabs change or language changes
  useEffect(() => {
    calculateVisibleTabsRef.current?.();
  }, [sortedTabs, langContext?.lang?.code]);

  const [containerWidth, setContainerWidth] = useState(0);

  // Set up resize observer
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      setContainerWidth(containerRef.current?.offsetWidth || 0);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [setContainerWidth]);

  useEffect(() => {
    if (containerWidth !== 0) {
      calculateVisibleTabsRef.current?.();
    }
  }, [containerWidth]);

  // Don't render tabs if there's only one tab
  if (!report.tabs || report.tabs.length <= 1) {
    return null;
  }

  const isDisabled = !!selectedForEditing;

  // Helper function to render a tab with optional drag & drop
  const renderTab = (tab: (typeof report.tabs)[0]) => {
    const tabContent = (
      <Tabs.Trigger
        ref={(el) => {
          if (el) {
            tabRefs.current.set(tab.id, el);
          } else {
            tabRefs.current.delete(tab.id);
          }
        }}
        value={tab.id.toString()}
        className={`whitespace-nowrap w-full px-4 py-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 text-center items-center justify-center ${
          isDisabled
            ? "text-gray-400 cursor-not-allowed opacity-60"
            : "text-gray-600 hover:text-gray-900 hover:bg-blue-200/10"
        } data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 ${
          isDisabled ? "data-[state=active]:opacity-60" : ""
        }`}
        style={{
          display: visibleTabs.some((t) => t.id === tab.id) ? "flex" : "none",
        }}
      >
        {getLocalizedTabTitle(tab)}
      </Tabs.Trigger>
    );

    if (enableDragDrop) {
      return (
        <Droppable key={tab.id} droppableId={`tab-header-${tab.id}`}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 ${
                snapshot.isDraggingOver
                  ? "bg-blue-200 border-b-2 border-blue-500 shadow-lg"
                  : ""
              }`}
            >
              {tabContent}
            </div>
          )}
        </Droppable>
      );
    } else {
      return (
        <div key={tab.id} className="flex-1">
          {tabContent}
        </div>
      );
    }
  };

  return (
    <Tabs.Root
      value={selectedTabId.toString()}
      onValueChange={(value) => {
        // Only update if the value is a valid tab ID (not "overflow") and not disabled
        if (value !== "overflow" && !isDisabled) {
          setSelectedTabId(parseInt(value));
        }
      }}
      className={`w-full ${isDisabled ? "pointer-events-none" : ""}`}
    >
      <Tabs.List
        ref={containerRef}
        className="flex border-b border-gray-200 bg-white rounded-t-lg"
      >
        {visibleTabs.map((tab) => renderTab(tab))}

        {overflowTabs.length > 0 && (
          <div className="flex-none">
            <DropdownMenu.Root
              open={dropdownOpen}
              onOpenChange={setDropdownOpen}
            >
              <DropdownMenu.Trigger asChild>
                <Tabs.Trigger
                  value={
                    isSelectedTabInOverflow
                      ? selectedTabId.toString()
                      : "overflow"
                  }
                  className={`flex px-4 py-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 w-32 overflow-x-hidden text-center items-center justify-center ${
                    isSelectedTabInOverflow
                      ? `text-blue-600 border-b-2 border-blue-600 bg-blue-50 ${
                          isDisabled ? "opacity-60" : ""
                        }`
                      : isDisabled
                      ? "text-gray-400 cursor-not-allowed opacity-60"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {isSelectedTabInOverflow ? (
                    <>
                      <span className="truncate flex-1">
                        {selectedTab ? getLocalizedTabTitle(selectedTab) : ""}
                      </span>
                      <ChevronDownIcon className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      <span>{t("More")}</span>
                      <ChevronDownIcon className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Tabs.Trigger>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[200px] bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50"
                  side="bottom"
                  align="end"
                  sideOffset={5}
                >
                  {overflowTabs.map((tab) => (
                    <DropdownMenu.Item
                      key={tab.id}
                      className={`flex items-center px-4 py-2 text-sm cursor-pointer data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 ${
                        isDisabled
                          ? "text-gray-400 cursor-not-allowed opacity-60"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onSelect={() => {
                        if (!isDisabled) {
                          setSelectedTabId(tab.id);
                          setDropdownOpen(false);
                        }
                      }}
                    >
                      {getLocalizedTabTitle(tab)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
      </Tabs.List>
    </Tabs.Root>
  );
}
