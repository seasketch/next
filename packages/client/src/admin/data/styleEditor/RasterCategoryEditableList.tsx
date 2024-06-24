import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import { Expression } from "mapbox-gl";
import SortableCategoryListEditor from "./SortableCategoryListEditor";
import { FontSizeIcon } from "@radix-ui/react-icons";

export function RasterCategoryEditableList({
  rasterColorExpression,
  metadata,
  onChange,
}: {
  rasterColorExpression: Expression;
  metadata?: Editor.SeaSketchLayerMetadata;
  onChange: (expression: Expression, metadata: { [key: string]: any }) => void;
}) {
  return (
    <Editor.Root block className="pt-3">
      <div className="border rounded border-gray-500 p-4 bg-gray-700">
        <Editor.Label
          title={<Trans ns="admin:data">Categories</Trans>}
          buttons={
            <>
              <button
                className="text-indigo-300 hover:text-indigo-400"
                title="Alphabetize labels"
                onClick={() => {
                  const categories = Editor.extractCategoriesFromExpression(
                    rasterColorExpression
                  );
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

                  onChange(rasterColorExpression, {
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
            expression={rasterColorExpression}
            metadata={metadata}
            onChange={onChange}
          />
        </Editor.Control>
      </div>
    </Editor.Root>
  );
}
