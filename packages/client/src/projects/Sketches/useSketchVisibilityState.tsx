import { useCallback, useContext, useEffect, useState } from "react";
import { MapContext } from "../../dataLayers/MapContextManager";

export default function useSketchVisibilityState() {
  const mapContext = useContext(MapContext);
  const [visibleSketches, setVisibleSketches] = useState<string[]>([]);

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
