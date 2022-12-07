import * as MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Feature } from "geojson";
import { LngLatLike } from "mapbox-gl";
import getKinks from "@turf/kinks";
// import createSupplementaryPoints from "../lib/create_supplementary_points";

const Preprocessing: any = {};

Preprocessing.onSetup = function ({
  preprocessingEndpoint,
  featureId,
}: {
  preprocessingEndpoint: string;
  featureId: string;
}) {
  // turn the opts into state.
  const state = {
    dragMoveLocation: null,
    boxSelectStartLocation: null,
    boxSelectElement: undefined,
    boxSelecting: false,
    canBoxSelect: false,
    dragMoving: false,
    canDragMove: false,
    featureId: featureId,
    endpoint: preprocessingEndpoint,
  };

  this.isAnimating = false;
  this.featureId = featureId;

  // this.setSelected([this.getFeature(state.featureId)]);

  const feature = this.getFeature(state.featureId);
  console.log("feature", feature);

  if (!preprocessingEndpoint) {
    throw new Error("Preprocessing endpoint not specified");
  }
  if (!feature) {
    throw new Error("No feature for preprocessing!?");
  }
  fetch(preprocessingEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feature: feature.toGeoJSON() }),
  })
    .then(async (response) => {
      const data = await response.json();
      console.log(data);
    })
    .catch((e) => {
      // TODO: handle this in digitizing tools
      throw new Error("Problem submitting shape for preprocessing");
    });

  // this.fireActionable();

  // this.setActionableState({
  //   combineFeatures: true,
  //   uncombineFeatures: true,
  //   trash: true
  // });

  return state;
};

Preprocessing.onStop = function () {
  this.isAnimating = false;
};

// Preprocessing.fireUpdate = function() {
//   this.map.fire(Constants.events.UPDATE, {
//     action: Constants.updateActions.MOVE,
//     features: this.getSelected().map(f => f.toGeoJSON())
//   });
// };

// Preprocessing.fireActionable = function() {
//   const selectedFeatures = this.getSelected();

//   const multiFeatures = selectedFeatures.filter(
//     feature => this.isInstanceOf('MultiFeature', feature)
//   );

//   let combineFeatures = false;

//   if (selectedFeatures.length > 1) {
//     combineFeatures = true;
//     const featureType = selectedFeatures[0].type.replace('Multi', '');
//     selectedFeatures.forEach((feature) => {
//       if (feature.type.replace('Multi', '') !== featureType) {
//         combineFeatures = false;
//       }
//     });
//   }

//   const uncombineFeatures = multiFeatures.length > 0;
//   const trash = selectedFeatures.length > 0;

//   this.setActionableState({
//     combineFeatures, uncombineFeatures, trash
//   });
// };

// Preprocessing.getUniqueIds = function(allFeatures) {
//   if (!allFeatures.length) return [];
//   const ids = allFeatures.map(s => s.properties.id)
//     .filter(id => id !== undefined)
//     .reduce((memo, id) => {
//       memo.add(id);
//       return memo;
//     }, new StringSet());

//   return ids.values();
// };

// Preprocessing.stopExtendedInteractions = function(state) {
//   if (state.boxSelectElement) {
//     if (state.boxSelectElement.parentNode) state.boxSelectElement.parentNode.removeChild(state.boxSelectElement);
//     state.boxSelectElement = null;
//   }

//   this.map.dragPan.enable();

//   state.boxSelecting = false;
//   state.canBoxSelect = false;
//   state.dragMoving = false;
//   state.canDragMove = false;
// };

// Preprocessing.onStop = function() {
//   doubleClickZoom.enable(this);
// };

// Preprocessing.onMouseMove = function(state) {
//   // On mousemove that is not a drag, stop extended interactions.
//   // This is useful if you drag off the canvas, release the button,
//   // then move the mouse back over the canvas --- we don't allow the
//   // interaction to continue then, but we do let it continue if you held
//   // the mouse button that whole time
//   this.stopExtendedInteractions(state);

//   // Skip render
//   return true;
// };

// Preprocessing.onMouseOut = function(state) {
//   // As soon as you mouse leaves the canvas, update the feature
//   if (state.dragMoving) return this.fireUpdate();

//   // Skip render
//   return true;
// };

// Preprocessing.onTap = Preprocessing.onClick = function(state, e) {
//   // Click (with or without shift) on no feature
//   if (CommonSelectors.noTarget(e)) return this.clickAnywhere(state, e); // also tap
//   if (CommonSelectors.isOfMetaType(Constants.meta.VERTEX)(e)) return this.clickOnVertex(state, e); //tap
//   if (CommonSelectors.isFeature(e)) return this.clickOnFeature(state, e);
// };

// Preprocessing.clickAnywhere = function (state) {
//   // Clear the re-render selection
//   const wasSelected = this.getSelectedIds();
//   if (wasSelected.length) {
//     this.clearSelectedFeatures();
//     wasSelected.forEach(id => this.doRender(id));
//   }
//   doubleClickZoom.enable(this);
//   this.stopExtendedInteractions(state);
// };

// Preprocessing.clickOnVertex = function(state, e) {
//   // Enter direct select mode
//   this.changeMode(Constants.modes.DIRECT_SELECT, {
//     featureId: e.featureTarget.properties.parent,
//     coordPath: e.featureTarget.properties.coord_path,
//     startPos: e.lngLat
//   });
//   this.updateUIClasses({ mouse: Constants.cursors.MOVE });
// };

// Preprocessing.startOnActiveFeature = function(state, e) {
//   // Stop any already-underway extended interactions
//   this.stopExtendedInteractions(state);

//   // Disable map.dragPan immediately so it can't start
//   this.map.dragPan.disable();

//   // Re-render it and enable drag move
//   this.doRender(e.featureTarget.properties.id);

//   // Set up the state for drag moving
//   state.canDragMove = true;
//   state.dragMoveLocation = e.lngLat;
// };

// Preprocessing.clickOnFeature = function(state, e) {
//   // Stop everything
//   doubleClickZoom.disable(this);
//   this.stopExtendedInteractions(state);

//   const isShiftClick = CommonSelectors.isShiftDown(e);
//   const selectedFeatureIds = this.getSelectedIds();
//   const featureId = e.featureTarget.properties.id;
//   const isFeatureSelected = this.isSelected(featureId);

//   // Click (without shift) on any selected feature but a point
//   if (!isShiftClick && isFeatureSelected && this.getFeature(featureId).type !== Constants.geojsonTypes.POINT) {
//     // Enter direct select mode
//     return this.changeMode(Constants.modes.DIRECT_SELECT, {
//       featureId
//     });
//   }

//   // Shift-click on a selected feature
//   if (isFeatureSelected && isShiftClick) {
//     // Deselect it
//     this.deselect(featureId);
//     this.updateUIClasses({ mouse: Constants.cursors.POINTER });
//     if (selectedFeatureIds.length === 1) {
//       doubleClickZoom.enable(this);
//     }
//   // Shift-click on an unselected feature
//   } else if (!isFeatureSelected && isShiftClick) {
//     // Add it to the selection
//     this.select(featureId);
//     this.updateUIClasses({ mouse: Constants.cursors.MOVE });
//   // Click (without shift) on an unselected feature
//   } else if (!isFeatureSelected && !isShiftClick) {
//     // Make it the only selected feature
//     selectedFeatureIds.forEach(id => this.doRender(id));
//     this.setSelected(featureId);
//     this.updateUIClasses({ mouse: Constants.cursors.MOVE });
//   }

//   // No matter what, re-render the clicked feature
//   this.doRender(featureId);
// };

// Preprocessing.onMouseDown = function(state, e) {
//   if (CommonSelectors.isActiveFeature(e)) return this.startOnActiveFeature(state, e);
//   if (this.drawConfig.boxSelect && CommonSelectors.isShiftMousedown(e)) return this.startBoxSelect(state, e);
// };

// Preprocessing.startBoxSelect = function(state, e) {
//   this.stopExtendedInteractions(state);
//   this.map.dragPan.disable();
//   // Enable box select
//   state.boxSelectStartLocation = mouseEventPoint(e.originalEvent, this.map.getContainer());
//   state.canBoxSelect = true;
// };

// Preprocessing.onTouchStart = function(state, e) {
//   if (CommonSelectors.isActiveFeature(e)) return this.startOnActiveFeature(state, e);
// };

// Preprocessing.onDrag = function(state, e) {
//   if (state.canDragMove) return this.dragMove(state, e);
//   if (this.drawConfig.boxSelect && state.canBoxSelect) return this.whileBoxSelect(state, e);
// };

// Preprocessing.whileBoxSelect = function(state, e) {
//   state.boxSelecting = true;
//   this.updateUIClasses({ mouse: Constants.cursors.ADD });

//   // Create the box node if it doesn't exist
//   if (!state.boxSelectElement) {
//     state.boxSelectElement = document.createElement('div');
//     state.boxSelectElement.classList.add(Constants.classes.BOX_SELECT);
//     this.map.getContainer().appendChild(state.boxSelectElement);
//   }

//   // Adjust the box node's width and xy position
//   const current = mouseEventPoint(e.originalEvent, this.map.getContainer());
//   const minX = Math.min(state.boxSelectStartLocation.x, current.x);
//   const maxX = Math.max(state.boxSelectStartLocation.x, current.x);
//   const minY = Math.min(state.boxSelectStartLocation.y, current.y);
//   const maxY = Math.max(state.boxSelectStartLocation.y, current.y);
//   const translateValue = `translate(${minX}px, ${minY}px)`;
//   state.boxSelectElement.style.transform = translateValue;
//   state.boxSelectElement.style.WebkitTransform = translateValue;
//   state.boxSelectElement.style.width = `${maxX - minX}px`;
//   state.boxSelectElement.style.height = `${maxY - minY}px`;
// };

// Preprocessing.dragMove = function(state, e) {
//   // Dragging when drag move is enabled
//   state.dragMoving = true;
//   e.originalEvent.stopPropagation();

//   const delta = {
//     lng: e.lngLat.lng - state.dragMoveLocation.lng,
//     lat: e.lngLat.lat - state.dragMoveLocation.lat
//   };

//   moveFeatures(this.getSelected(), delta);

//   state.dragMoveLocation = e.lngLat;
// };

// Preprocessing.onTouchEnd = Preprocessing.onMouseUp = function(state, e) {
//   // End any extended interactions
//   if (state.dragMoving) {
//     this.fireUpdate();
//   } else if (state.boxSelecting) {
//     const bbox = [
//       state.boxSelectStartLocation,
//       mouseEventPoint(e.originalEvent, this.map.getContainer())
//     ];
//     const featuresInBox = this.featuresAt(null, bbox, 'click');
//     const idsToSelect = this.getUniqueIds(featuresInBox)
//       .filter(id => !this.isSelected(id));

//     if (idsToSelect.length) {
//       this.select(idsToSelect);
//       idsToSelect.forEach(id => this.doRender(id));
//       this.updateUIClasses({ mouse: Constants.cursors.MOVE });
//     }
//   }
//   this.stopExtendedInteractions(state);
// };

Preprocessing.toDisplayFeatures = function (
  state: any,
  geojson: Feature,
  display: any
) {
  geojson.properties!.preprocessing = "true";
  // TODO: handle kinks
  display(geojson);

  this.isAnimating = true;
  window.requestAnimationFrame(this.animate.bind(this));
};

const ANIMATION_INTERVAL = 10000;

Preprocessing.animate = function (time: number) {
  // console.log(this);

  if (this.isAnimating && this.featureId) {
    let fraction = Math.round(time % ANIMATION_INTERVAL) / ANIMATION_INTERVAL;
    if (this.lastFraction > 0 && fraction < this.lastFraction) {
      this.reverse = !Boolean(this.reverse);
    }
    this.lastFraction = fraction;
    if (this.reverse) {
      fraction = 1 - fraction;
    }
    const source = this.map.getSource("mapbox-gl-draw-cold");

    if (source) {
      const fc = source._data;
      fc.features[0].properties["animationFraction"] = fraction;
      source.setData(fc);
      // this.map.setFeatureState(
      //   { id: this.featureId, source: "mapbox-gl-draw-hot" },
      //   { animationFraction: fraction }
      // );
      this.map.setFeatureState(
        { id: this.featureId, source: "mapbox-gl-draw-cold" },
        { animationFraction: fraction }
      );
      // this.map.triggerRepaint();
      // console.log("animate", percent, this.featureId, this);
      // setTimeout(() => {
      window.requestAnimationFrame(this.animate.bind(this));
      // }, 1000);
    }
  }
};

// Preprocessing.onTrash = function() {
//   this.deleteFeature(this.getSelectedIds());
//   this.fireActionable();
// };

// Preprocessing.onCombineFeatures = function() {
//   const selectedFeatures = this.getSelected();

//   if (selectedFeatures.length === 0 || selectedFeatures.length < 2) return;

//   const coordinates = [], featuresCombined = [];
//   const featureType = selectedFeatures[0].type.replace('Multi', '');

//   for (let i = 0; i < selectedFeatures.length; i++) {
//     const feature = selectedFeatures[i];

//     if (feature.type.replace('Multi', '') !== featureType) {
//       return;
//     }
//     if (feature.type.includes('Multi')) {
//       feature.getCoordinates().forEach((subcoords) => {
//         coordinates.push(subcoords);
//       });
//     } else {
//       coordinates.push(feature.getCoordinates());
//     }

//     featuresCombined.push(feature.toGeoJSON());
//   }

//   if (featuresCombined.length > 1) {
//     const multiFeature = this.newFeature({
//       type: Constants.geojsonTypes.FEATURE,
//       properties: featuresCombined[0].properties,
//       geometry: {
//         type: `Multi${featureType}`,
//         coordinates
//       }
//     });

//     this.addFeature(multiFeature);
//     this.deleteFeature(this.getSelectedIds(), { silent: true });
//     this.setSelected([multiFeature.id]);

//     this.map.fire(Constants.events.COMBINE_FEATURES, {
//       createdFeatures: [multiFeature.toGeoJSON()],
//       deletedFeatures: featuresCombined
//     });
//   }
//   this.fireActionable();
// };

// Preprocessing.onUncombineFeatures = function() {
//   const selectedFeatures = this.getSelected();
//   if (selectedFeatures.length === 0) return;

//   const createdFeatures = [];
//   const featuresUncombined = [];

//   for (let i = 0; i < selectedFeatures.length; i++) {
//     const feature = selectedFeatures[i];

//     if (this.isInstanceOf('MultiFeature', feature)) {
//       feature.getFeatures().forEach((subFeature) => {
//         this.addFeature(subFeature);
//         subFeature.properties = feature.properties;
//         createdFeatures.push(subFeature.toGeoJSON());
//         this.select([subFeature.id]);
//       });
//       this.deleteFeature(feature.id, { silent: true });
//       featuresUncombined.push(feature.toGeoJSON());
//     }
//   }

//   if (createdFeatures.length > 1) {
//     this.map.fire(Constants.events.UNCOMBINE_FEATURES, {
//       createdFeatures,
//       deletedFeatures: featuresUncombined
//     });
//   }
//   this.fireActionable();
// };

export default Preprocessing;
