import { Feature, FeatureCollection, LineString, Point } from "geojson";
import mapboxgl, { GeoJSONSource, Map } from "mapbox-gl";

let featureId = 0;

const emptyFeatureCollection = () =>
  ({
    type: "FeatureCollection",
    features: [],
  } as FeatureCollection);

export const measureLayers: mapboxgl.AnyLayer[] = [
  {
    id: "__measure-lines",
    type: "line",
    source: "__measure-lines",
    filter: ["in", "$type", "LineString"],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#555",
      "line-width": 5,
    },
  },
  {
    id: "__measure-lines-inner",
    type: "line",
    source: "__measure-lines",
    filter: ["in", "$type", "LineString"],
    layout: {
      "line-cap": "square",
      "line-join": "round",
    },
    paint: {
      "line-color": "white",
      "line-width": 3,
      "line-dasharray": [3, 5, 3],
    },
  },
  // {
  //   id: "__measure-hoverpoints",
  //   type: "circle",
  //   source: "__measure-points",
  //   filter: ["boolean", ["feature-state", "hover"], false],
  //   paint: {
  //     "circle-radius": 10,
  //     "circle-color": "rgba(255, 255, 255, 0.5)",
  //   },
  // },
  {
    id: "__measure-points-halo",
    type: "circle",
    source: "__measure-points",
    filter: ["in", "$type", "Point"],
    paint: {
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "halo"], true],
        8,
        1,
      ],
      "circle-color": [
        "case",
        ["boolean", ["feature-state", "halo"], true],
        "rgba(255, 255, 255, 0.4)",
        "rgba(255, 255, 255, 0)",
      ],
      "circle-radius-transition": {
        duration: 500,
      },
      "circle-color-transition": {
        duration: 500,
      },
    },
  },
  {
    id: "__measure-points",
    type: "circle",
    source: "__measure-points",
    filter: ["in", "$type", "Point"],
    paint: {
      "circle-radius": 4,
      "circle-color": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        "red",
        "#555",
      ],
    },
  },
  {
    id: "__measure-points-inner",
    type: "circle",
    source: "__measure-points",
    filter: ["in", "$type", "Point"],
    paint: {
      "circle-radius": 2,
      "circle-color": "white",
    },
  },
  // {
  //   id: "measure-midpoints",
  //   type: "circle",
  //   source: "__measure-midpoints",
  //   filter: ["in", "$type", "Point"],
  //   paint: {
  //     "circle-radius": 3,
  //     "circle-color": "#000",
  //   },
  // },
];

// copy __measure-points-* to __measure-cursor-*
for (const layer of measureLayers) {
  if (
    layer.id.startsWith("__measure-points") &&
    layer.id !== "__measure-points-halo"
  ) {
    measureLayers.push({
      ...layer,
      id: layer.id.replace("__measure-points", "__measure-cursor"),
      // @ts-ignore
      source: "__measure-cursor",
    });
  }
}

class MeasureControl {
  private map: Map;
  private points = emptyFeatureCollection() as FeatureCollection<Point>;
  private lines = emptyFeatureCollection() as FeatureCollection<LineString>;
  private cursor = emptyFeatureCollection() as FeatureCollection<Point>;

  private state: "drawing" | "editing" | "dragging" = "drawing";
  private draggedPointIndex: number = 0;
  private isDestroyed = false;

  constructor(map: Map) {
    this.map = map;
    this.map.on("remove", this.destroy);
  }

  /**
   * Enter draw mode to start a new measurement
   */
  enable() {
    // add layers and sources to map
    const sources = this.getSources();
    for (const id in sources) {
      this.map.addSource(id, sources[id]);
    }
    for (const layer of measureLayers) {
      this.map.addLayer(layer);
    }
    this.map.on("click", this.onDrawClick);
    this.map.on("mousemove", this.onCursorMove);
    document.body.addEventListener("keydown", this.onKeyDown);
    this.map.on("mouseover", "__measure-points", this.onMouseOverPoint);
    this.map.on("mouseout", "__measure-points", this.onMouseOutPoint);
    this.setMousePointer("default");
  }

  /**
   * Teardown method to remove all layers, sources, and event listeners from the
   * map. Call before discarding this instance of MeasureControl.
   */
  destroy = () => {
    for (const layer of measureLayers) {
      this.map.removeLayer(layer.id);
    }
    const sources = this.getSources();
    for (const id in sources) {
      if (this.map.getSource(id)) {
        this.map.removeSource(id);
      }
    }
    this.map.off("remove", this.destroy);
    this.map.off("click", this.onDrawClick);
    this.map.off("mousemove", this.onCursorMove);
    document.body.removeEventListener("keydown", this.onKeyDown);
    this.map.off("mouseover", "__measure-points", this.onMouseOverPoint);
    this.map.off("mouseout", "__measure-points", this.onMouseOutPoint);
    this.map.off("mousedown", this.onBeginDragPoint);
    this.map.off("click", "__measure-points", this.onClickLastPoint);
    this.map.off("mouseout", "__measure-points", this.onMouseOutLastPoint);
    this.map.off("mousemove", this.onDragPoint);
    this.map.off("mouseup", this.onEndDragPoint);
    this.map.off("mouseout", "__measure-points", this.onMouseOutPoint);
    this.isDestroyed = true;
  };

  onKeyDown = (e: KeyboardEvent) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    if (e.key === "Escape" && this.state === "drawing") {
      this.stopEditing();
    }
  };

  stopEditing = () => {
    this.state = "editing";
    // update the points source
    const source = this.map.getSource("__measure-points") as GeoJSONSource;
    source.setData(this.points);
    // clear the cursor source
    this.clearCursor();
    this.clearHalos();
    // update the linestring
    this.updateLineString();

    this.map.off("mousemove", this.onCursorMove);
    this.map.off("click", this.onDrawClick);
    this.setMousePointer("default");
    // start editing mode
  };

  onMouseOverPoint = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    if (this.state === "drawing") {
      if (e.features.length > 0) {
        const feature = e.features[0];
        if (this.points.features.length > 1) {
          const lastPoint =
            this.points.features[this.points.features.length - 1];
          if (lastPoint.id === feature.id) {
            this.handleIsOverLastPoint(lastPoint.id! as number);
            return;
          }
        }
      }
    } else if (this.state === "editing") {
      if (e.features.length > 0) {
        this.map.dragPan.disable();
        // change cursor to pointer
        this.setMousePointer("pointer");
        const coords = e.features[0].geometry.coordinates;
        this.updateHoverPoint(coords);
        const index = this.points.features.findIndex(
          (point) => point.id === e.features[0].id
        );
        if (this.draggedPointIndex) {
          this.map.removeFeatureState(
            {
              source: "__measure-points",
              id: this.points.features[this.draggedPointIndex].id,
            },
            "hover"
          );
        }
        this.draggedPointIndex = index;
        this.map.setFeatureState(
          {
            source: "__measure-points",
            id: e.features[0].id,
          },
          {
            hover: true,
          }
        );
        this.map.on("mousedown", this.onBeginDragPoint);
      }
    }
  };

  private isOverLastPoint = false;

  private handleIsOverLastPoint = (id: number) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    this.isOverLastPoint = true;
    // add new last point click handler
    this.map.on("click", "__measure-points", this.onClickLastPoint);
    // change cursor to pointer
    this.setMousePointer("pointer");
    // suspend mousemove and click handlers
    this.map.off("mousemove", this.onCursorMove);
    this.map.off("click", this.onDrawClick);
    // remove cursor from points source
    this.clearCursor();
    // redraw linestring
    this.updateLineString();
    // add feature-state hover to last point
    this.map.setFeatureState(
      {
        source: "__measure-points",
        id,
      },
      {
        halo: true,
      }
    );
  };

  private onClickLastPoint = () => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    this.map.off("click", "__measure-points", this.onClickLastPoint);
    this.map.off("mouseout", "__measure-points", this.onMouseOutLastPoint);
    this.stopEditing();
  };

  private clearCursor = () => {
    const cursorSource = this.map.getSource(
      "__measure-cursor"
    ) as GeoJSONSource;
    this.cursor.features = [];
    cursorSource.setData(this.cursor);
  };

  private clearHalos = () => {
    // loop through all points, remove halo feature-state
    for (const point of this.points.features) {
      this.map.setFeatureState(
        {
          source: "__measure-points",
          id: point.id,
        },
        {
          halo: false,
        }
      );
    }
  };

  private setMousePointer(type: "default" | "pointer") {
    this.map.getCanvas().style.setProperty("cursor", type);
  }

  onMouseOutLastPoint = () => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }
    this.isOverLastPoint = false;
    this.setMousePointer("default");
    // unregister last point click handler
    // resume mousemove and click handlers
    this.map.on("mousemove", this.onCursorMove);
    this.map.on("click", this.onDrawClick);
    this.map.off("mouseout", "__measure-points", this.onMouseOutLastPoint);
    this.map.on("mouseout", "__measure-points", this.onMouseOutPoint);
    this.map.off("click", "__measure-points", this.stopEditing);
    // remove feature-state hover from last point
    this.clearHalos();
  };

  onMouseOutPoint = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }

    if (this.state === "drawing") {
      if (this.isOverLastPoint) {
        this.onMouseOutLastPoint();
      } else {
        this.clearHalos();
      }
    } else if (this.state === "editing") {
      this.map.dragPan.enable();
      this.setMousePointer("default");
      this.updateHoverPoint(null);

      this.map.removeFeatureState(
        {
          source: "__measure-points",
          id: this.points.features[this.draggedPointIndex]?.id,
        },
        "hover"
      );
      console.log("resetting index");
      this.draggedPointIndex = 0;
    }
  };

  updatePointCoordinates(index: number, coords: number[]) {
    const point = this.points.features[index];
    if (point) {
      point.geometry.coordinates = coords;
      this.updateLineString();
      const source = this.map.getSource("__measure-points") as GeoJSONSource;
      source.setData(this.points);
    }
  }

  onBeginDragPoint = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }

    // get index of point with matching coordinates
    this.map.on("mousemove", this.onDragPoint);
    this.map.once("mouseup", this.onEndDragPoint);
  };

  onEndDragPoint = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }

    this.map.off("mousemove", this.onDragPoint);
  };

  onDragPoint = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }

    console.log(this.draggedPointIndex);
    this.updatePointCoordinates(this.draggedPointIndex, e.lngLat.toArray());
  };

  onDrawClick = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }

    // get location of click
    const coords = e.lngLat.toArray();
    // // are there any features associated with the event?
    // if (e.features && e.features.length > 0) {
    //   this.stopEditing();
    // } else {
    this.addPoint(coords);
    this.updateLineString();
    // set cursor to pointer
    this.map.getCanvas().style.setProperty("cursor", "pointer");
    // }
  };

  /**
   * Mousemove handler for drawing mode. Updates the cursor position.
   */
  onCursorMove = (e: any) => {
    if (this.isDestroyed) {
      throw new Error("MeasureControl is destroyed");
    }

    if (this.isOverLastPoint) {
      return;
    }
    const coords = e.lngLat.toArray();
    const source = this.map.getSource("__measure-cursor") as GeoJSONSource;
    // set new cursor
    this.cursor.features = [
      {
        type: "Feature",
        id: featureId++,
        geometry: {
          type: "Point",
          coordinates: coords,
        },
        properties: {},
      },
    ];
    source.setData(this.cursor);
    // update the line source
    this.updateLineString();
  };

  updateHoverPoint = (coords: [number, number] | null) => {
    return;
    // const source = this.map.getSource("__measure-hoverpoints") as GeoJSONSource;
    // if (!coords) {
    //   this.hoverPoint = null;
    // } else {
    //   this.hoverPoint = {
    //     type: "Feature",
    //     geometry: {
    //       type: "Point",
    //       coordinates: coords,
    //     },
    //     properties: {},
    //   };
    // }
    // source.setData(
    //   this.hoverPoint
    //     ? this.hoverPoint
    //     : { type: "FeatureCollection", features: [] }
    // );
  };

  /**
   * Updates the linestring source with a line generated from the current points
   * source FeatureCollection.
   */
  updateLineString() {
    const points = this.points.features.map((f) => f.geometry.coordinates);
    if (this.cursor.features.length > 0) {
      points.push(this.cursor.features[0].geometry.coordinates);
    }
    this.lines = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: points,
          },
          properties: {},
        },
      ],
    };
    const source = this.map.getSource("__measure-lines") as GeoJSONSource;
    source.setData(this.lines);
  }

  /**
   * Adds a new point to the points source and updates the map.
   */
  addPoint(coords: [number, number]) {
    const id = featureId++;
    this.points.features.push({
      type: "Feature",
      id,
      geometry: {
        type: "Point",
        coordinates: coords,
      },
      properties: {},
    });
    const source = this.map.getSource("__measure-points") as GeoJSONSource;
    source.setData(this.points);
  }

  /**
   * Returns mapbox-gl sources that can be added to the map. Used by
   * MapContextManager.getComputedStyle.
   * @returns a map of sources to be added to the map
   */
  getSources() {
    const sources: { [id: string]: mapboxgl.AnySourceData } = {};
    sources["__measure-points"] = {
      type: "geojson",
      data: this.points,
    };
    sources["__measure-lines"] = {
      type: "geojson",
      data: this.lines,
    };
    sources["__measure-cursor"] = {
      type: "geojson",
      data: this.cursor,
    };
    return sources;
  }
}

export default MeasureControl;
