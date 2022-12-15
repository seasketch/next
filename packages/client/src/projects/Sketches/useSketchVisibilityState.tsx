import { useCallback, useContext, useEffect } from "react";
import { MapContext } from "../../dataLayers/MapContextManager";
import { SketchTocDetailsFragment } from "../../generated/graphql";
import getSlug from "../../getSlug";
import useLocalStorage from "../../useLocalStorage";

export default function useSketchVisibilityState(
  sketches: SketchTocDetailsFragment[]
) {
  const mapContext = useContext(MapContext);
  const [visibleSketches, setVisibleSketches] = useLocalStorage<string[]>(
    `myplans-sketch-visibility-${getSlug()}`,
    []
  );

  const onChecked = useCallback(
    (items: string[], isChecked: boolean) => {
      setVisibleSketches((prev) => [
        ...prev.filter((id) => items.indexOf(id) === -1),
        ...(isChecked ? items : []),
      ]);
    },
    [setVisibleSketches]
  );

  useEffect(() => {
    if (mapContext.manager && sketches.length) {
      mapContext.manager.setVisibleSketches(
        visibleSketches
          .filter((id) => /Sketch:/.test(id))
          .map((id) => parseInt(id.split(":")[1]))
          .map((id) => sketches.find((s) => s.id === id))
          .filter((sketch) => sketch !== undefined)
          .map((sketch) => ({
            id: sketch!.id,
            timestamp: sketch!.timestamp,
          }))
      );
    }
  }, [visibleSketches, mapContext.manager, sketches]);

  return { visibleSketches, setVisibleSketches, onChecked };
}
