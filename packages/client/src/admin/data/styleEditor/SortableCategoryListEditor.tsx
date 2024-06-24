import React, { useMemo, useState } from "react";
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
          {categories.map((category, i) => {
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
        </SortableContext>
      </DndContext>
    </ul>
  );
}
