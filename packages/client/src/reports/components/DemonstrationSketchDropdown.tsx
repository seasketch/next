import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
} from "../../components/Menubar";
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

  return (
    <DropdownMenu.Root
      open={sketchDropdownOpen}
      onOpenChange={setSketchDropdownOpen}
    >
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 hover:text-gray-600 focus:outline-none">
          <span>
            {selectedSketchId ? (
              demonstrationSketches.find(
                (sketch) => sketch.id === selectedSketchId
              )?.name
            ) : (
              <Skeleton className="w-48 h-6" />
            )}
          </span>
          {selectedSketchId && (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={MenuBarContentClasses}
          side="bottom"
          align="start"
          sideOffset={5}
        >
          <p className="text-sm text-gray-600 px-2 py-1">
            {t(
              "Choose from the following sketches to demonstrate this report."
            )}
          </p>
          <DropdownMenu.Separator />
          {demonstrationSketches.map((sketch) => (
            <DropdownMenu.Item
              key={sketch.id}
              className={MenuBarItemClasses}
              onSelect={() => {
                setSelectedSketchId(sketch.id);
                setSketchDropdownOpen(false);
              }}
            >
              <span
                className={sketch.id === selectedSketchId ? "font-medium" : ""}
              >
                {sketch.name}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
