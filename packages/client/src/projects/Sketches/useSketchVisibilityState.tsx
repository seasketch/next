import { useCallback, useContext, useEffect } from "react";
import { MapContext } from "../../dataLayers/MapContextManager";
import getSlug from "../../getSlug";
import useLocalStorage from "../../useLocalStorage";

export default function useSketchVisibilityState() {
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
    if (mapContext.manager) {
      mapContext.manager.setVisibleSketches(
        visibleSketches
          .filter((id) => /Sketch:/.test(id))
          .map((id) => parseInt(id.split(":")[1]))
      );
    }
  }, [visibleSketches, mapContext.manager]);

  return { visibleSketches, setVisibleSketches, onChecked };
}
