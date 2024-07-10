import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import { Expression } from "mapbox-gl";
import SortableCategoryListEditor from "./SortableCategoryListEditor";
import { FontSizeIcon } from "@radix-ui/react-icons";
import { memo, useEffect } from "react";

function _CategoryEditableList({
  expression,
  metadata,
  onChange,
}: {
  expression: Expression;
  metadata?: Editor.SeaSketchLayerMetadata;
  onChange: (expression: Expression, metadata: { [key: string]: any }) => void;
}) {
  return (
    <Editor.Root block className="pt-3">
      <div className="border rounded border-gray-500 p-4 bg-gray-700 max-h-160 overflow-y-scroll overflow-x-visible">
        <Editor.Label
          title={<Trans ns="admin:data">Categories</Trans>}
          buttons={
            <>
              <button
                className="text-indigo-300 hover:text-indigo-400"
                title="Alphabetize labels"
                onClick={() => {
                  const categories =
                    Editor.extractCategoriesFromExpression(expression);
                  const sorted = categories.sort((a, b) => {
                    const aLabel =
                      metadata?.["s:legend-labels"]?.[a.value] ||
                      a.value.toString();
                    const bLabel =
                      metadata?.["s:legend-labels"]?.[b.value] ||
                      b.value.toString();
                    return aLabel.localeCompare(bLabel);
                  });
                  // First, detect if s:sorted-categories is already sorted
                  // in ascending order. If it is, reverse it.
                  const sortedCategories = metadata?.["s:sorted-categories"];
                  const isSortedAscending = sortedCategories
                    ? sortedCategories.every(
                        (value, index) => value === sorted[index].value
                      )
                    : false;
                  if (isSortedAscending) {
                    sorted.reverse();
                  }

                  onChange(expression, {
                    ...metadata,
                    "s:sorted-categories": sorted.map((c) => c.value),
                  });
                }}
              >
                <FontSizeIcon />
              </button>
            </>
          }
        />
        <Editor.Control>
          <SortableCategoryListEditor
            expression={expression}
            metadata={metadata}
            onChange={onChange}
          />
        </Editor.Control>
      </div>
    </Editor.Root>
  );
}

export const CategoryEditableList = memo(_CategoryEditableList);
