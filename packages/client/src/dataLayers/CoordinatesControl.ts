import { throttle } from "lodash";
import { Map, MapMouseEvent, IControl } from "mapbox-gl";
/* eslint-disable i18next/no-literal-string */
class CoordinatesControl implements IControl {
  private container?: HTMLDivElement;

  onAdd(map: Map) {
    const div = document.createElement("div");
    div.className = "mapboxgl-ctrl mapboxgl-ctrl-group px-1 py-0.5";
    div.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    const mapCenter = map.getCenter();
    this.container = div;
    div.innerHTML = `${mapCenter
      .toArray()
      .map((v) => v.toFixed(6))
      .join(", ")}`;
    map.on("mousemove", throttle(this.onMouseMove, 100));
    return div;
  }

  onMouseMove = (e: MapMouseEvent) => {
    const div = this.container;
    if (div) {
      div.innerHTML = `${e.lngLat
        .toArray()
        .map((v) => v.toFixed(6))
        .join(", ")}`;
    }
  };

  onRemove(map: Map) {
    map.off("mousemove", this.onMouseMove);
    this.container?.remove();
  }
}

export default CoordinatesControl;
