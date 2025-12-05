import { createPortal } from "react-dom";
import { memo, useMemo } from "react";
import { SlashCommandItem } from "./plugin";

export interface SlashCommandPaletteProps {
  anchor: { top: number; left: number } | null;
  isVisible: boolean;
  items: SlashCommandItem[];
  query: string;
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
  onHighlight: (index: number) => void;
}

function SlashCommandPaletteComponent({
  anchor,
  isVisible,
  items,
  query,
  selectedIndex,
  onSelect,
  onHighlight,
}: SlashCommandPaletteProps) {
  // Group items by their group property
  const groupedItems = useMemo(() => {
    const groups = new Map<string, SlashCommandItem[]>();

    for (const item of items) {
      const groupName = item.group || "Other";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(item);
    }

    // Convert to array of [groupName, items] pairs, sorted by group name
    return Array.from(groups.entries()).sort(([a], [b]) => {
      // Put "Other" at the end
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [items]);

  const portalTarget =
    typeof document !== "undefined" ? document.body : undefined;

  if (!isVisible || !anchor || !portalTarget) {
    return null;
  }

  if (items.length === 0) {
    return createPortal(
      <div
        className="fixed z-20 w-64 rounded-md border border-gray-200 bg-white shadow-lg"
        style={{ top: anchor.top, left: anchor.left }}
        role="menu"
      >
        <div className="px-3 py-2 text-sm text-gray-500">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {query ? `No matches for "${query}"` : "No commands available"}
        </div>
      </div>,
      portalTarget
    );
  }

  // Track the current index as we iterate through groups
  let currentIndex = 0;

  return createPortal(
    <div
      className="fixed z-20 w-64 rounded-md border border-gray-200 bg-white shadow-lg max-h-96 overflow-y-auto"
      style={{ top: anchor.top, left: anchor.left }}
      role="menu"
    >
      {groupedItems.map(([groupName, groupItems]) => {
        const groupElements = groupItems.map((item) => {
          const index = currentIndex++;
          const isActive = index === selectedIndex;

          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onMouseEnter={() => onHighlight(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(item);
              }}
              className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors ${
                isActive ? "bg-gray-100 text-gray-900" : "text-gray-700"
              }`}
            >
              <div className="mt-1 text-gray-500">{item.icon}</div>
              <div className="flex flex-col">
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-gray-500">
                  {item.description}
                </span>
              </div>
            </button>
          );
        });

        return (
          <div key={groupName}>
            {groupedItems.length > 1 && (
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 first:border-t-0">
                {groupName}
              </div>
            )}
            {groupElements}
          </div>
        );
      })}
    </div>,
    portalTarget
  );
}

const SlashCommandPalette = memo(SlashCommandPaletteComponent);

export default SlashCommandPalette;
