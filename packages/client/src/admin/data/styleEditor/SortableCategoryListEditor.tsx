import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Expression } from "mapbox-gl";
import * as Editor from "./Editors";
import CategoryListItemEditor from "./CategoryListItemEditor";
import { Trans } from "react-i18next";

const THRESHOLD = 12;

export default function SortableCategoryListEditor({
  expression,
  metadata,
  onChange,
}: {
  expression: Expression;
  metadata?: Editor.SeaSketchLayerMetadata;
  onChange: (expression: Expression, metadata: { [key: string]: any }) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.value === active.id);
      const newIndex = categories.findIndex((c) => c.value === over.id);
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      onChange(expression, {
        ...metadata,
        "s:sorted-categories": newCategories.map((c) => c.value),
      });
    }
  }
  const categories = useMemo(() => {
    const categories = Editor.extractCategoriesFromExpression(expression);
    // sort categories based on metadata if available
    if (metadata?.["s:sorted-categories"]) {
      const sortedCategories = metadata["s:sorted-categories"];
      categories.sort((a, b) => {
        const aIndex = sortedCategories.indexOf(a.value);
        const bIndex = sortedCategories.indexOf(b.value);
        return aIndex - bIndex;
      });
    }
    return categories;
  }, [expression, metadata?.["s:sorted-categories"]]);

  const [showAll, setShowAll] = useState(categories.length < THRESHOLD);

  useEffect(() => {
    if (categories.length > THRESHOLD) {
      setShowAll(false);
    }
  }, [categories.length, setShowAll]);

  return (
    <ul className="w-full py-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map((c) => c.value)}
          strategy={verticalListSortingStrategy}
        >
          {categories
            .slice(0, showAll ? categories.length : THRESHOLD)
            .map((category, i) => {
              return (
                <CategoryListItemEditor
                  key={category.value}
                  category={category}
                  metadata={metadata}
                  expression={expression}
                  onChange={onChange}
                />
              );
            })}
          {categories.length > THRESHOLD && (
            <div className="w-full text-center mt-2">
              <button
                className="bg-gray-600 px-3 py-1 rounded-full"
                onClick={() => {
                  setShowAll((prev) => !prev);
                }}
              >
                <span>
                  {showAll ? (
                    <Trans ns="admin:data">Show less</Trans>
                  ) : (
                    <>
                      <Trans ns="admin:data">
                        Show all {categories.length.toLocaleString()} categories
                      </Trans>
                    </>
                  )}
                </span>
              </button>
            </div>
          )}
        </SortableContext>
      </DndContext>
    </ul>
  );
}
