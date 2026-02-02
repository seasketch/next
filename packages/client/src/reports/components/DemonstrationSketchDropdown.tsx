import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "../../components/Skeleton";
import { Sketch } from "../../generated/graphql";

export function DemonstrationSketchDropdown({
  demonstrationSketches,
  selectedSketchId,
  setSelectedSketchId,
}: {
  demonstrationSketches: Pick<Sketch, "id" | "name">[];
  selectedSketchId: number | null;
  setSelectedSketchId: (sketchId: number | null) => void;
}) {
  const { t } = useTranslation("admin:sketching");
  const [sketchDropdownOpen, setSketchDropdownOpen] = useState(false);

  const selectedSketch = demonstrationSketches.find(
    (sketch) => sketch.id === selectedSketchId
  );

  return (
    <DropdownMenu.Root
      open={sketchDropdownOpen}
      onOpenChange={setSketchDropdownOpen}
    >
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 focus:outline-none transition-colors">
          <span className="font-medium">
            {selectedSketchId ? (
              selectedSketch?.name
            ) : (
              <Skeleton className="w-48 h-5" />
            )}
          </span>
          {selectedSketchId && (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[200px] max-w-[320px] z-50"
          side="bottom"
          align="start"
          sideOffset={5}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500">
              {t("Select a sketch to preview the report")}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {demonstrationSketches.map((sketch) => {
              const isSelected = sketch.id === selectedSketchId;
              return (
                <DropdownMenu.Item
                  key={sketch.id}
                  className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer outline-none flex items-center justify-between gap-2"
                  onSelect={() => {
                    setSelectedSketchId(sketch.id);
                    setSketchDropdownOpen(false);
                  }}
                >
                  <span
                    className={`truncate ${
                      isSelected ? "font-medium text-gray-900" : ""
                    }`}
                  >
                    {sketch.name}
                  </span>
                  {isSelected && (
                    <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
