export interface GLLegendFillSymbol {
  type: "fill";
  color: string;
  extruded?: boolean;
  patternImageId?: string;
  /** 0-1 */
  fillOpacity: number;
  strokeWidth: number;
  strokeOpacity?: number;
  strokeColor?: string;
  dashed?: boolean;
}

export interface GLLegendLineSymbol {
  type: "line";
  color: string;
  strokeWidth: number;
  patternImageId?: string;
  dashed?: boolean;
  opacity?: number;
}

export interface GLLegendCircleSymbol {
  type: "circle";
  color: string;
  strokeWidth: number;
  strokeColor?: string;
  /** 0-1 */
  fillOpacity: number;
  strokeOpacity: number;
  radius: number;
}

// TODO: icon-color
export interface GLLegendMarkerSymbol {
  type: "marker";
  imageId: string;
  haloColor?: string;
  haloWidth?: number;
  rotation?: number;
  /** multiple of width & height to display */
  iconSize: number;
}

export interface GLLegendRGBRasterSymbol {
  type: "rgb-raster";
  representativeColors?: number[][];
}

export interface GLLegendVideoSymbol {
  type: "video";
}

export interface GLLegendTextSymbol {
  type: "text";
  color: string;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  haloColor?: string;
  haloWidth?: number;
}

export type GLLegendSymbol =
  | GLLegendFillSymbol
  | GLLegendCircleSymbol
  | GLLegendMarkerSymbol
  | GLLegendTextSymbol
  | GLLegendRGBRasterSymbol
  | GLLegendLineSymbol
  | GLLegendVideoSymbol;

export type GLLegendListPanel = {
  id: string;
  type: "GLLegendListPanel";
  label?: string;
  items: {
    id: string;
    label: string;
    symbol: GLLegendSymbol;
    value?: string | number;
  }[];
};

export type GLLegendFilterPanel = {
  id: string;
  type: "GLLegendFilterPanel";
  label: string;
  children: GLLegendPanel[];
};

/**
 * Display should be stacked if bubbles are big and can nest together, otherwise
 * display as a list.
 *
 * Note that a BubblePanel may be paired with a ListPanel for a common case of
 * a bubble chart with a categorical variable controlling the color of the bubbles.
 */
export type GLLegendBubblePanel = {
  id: string;
  type: "GLLegendBubblePanel";
  label?: string;
  stops: {
    value: number;
    radius: number;
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
  }[];
};

export type GLMarkerSizePanel = {
  id: string;
  type: "GLMarkerSizePanel";
  label?: string;
  stops: {
    id: string;
    imageId: string;
    value: number;
    iconSize: number;
    color?: string;
    haloColor?: string;
    haloWidth?: number;
    rotation?: number;
  }[];
};

export type GLLegendStepPanel = {
  id: string;
  type: "GLLegendStepPanel";
  label?: string;
  steps: {
    id: string;
    label: string;
    symbol: GLLegendSymbol;
    value: string | number;
  }[];
};

export type GLLegendHeatmapPanel = {
  id: string;
  type: "GLLegendHeatmapPanel";
  stops: { value: number; color: string }[];
};

export type GLLegendGradientPanel = {
  id: string;
  type: "GLLegendGradientPanel";
  label?: string;
  stops: { value: number; label: string; color: string }[];
};

export type GLLegendSimpleSymbolPanel = {
  id: string;
  type: "GLLegendSimpleSymbolPanel";
  label?: string;
  items: {
    id: string;
    label?: string;
    symbol: GLLegendSymbol;
  }[];
};

export type GLLegendPanel =
  | GLLegendListPanel
  | GLLegendBubblePanel
  | GLLegendHeatmapPanel
  | GLLegendGradientPanel
  | GLMarkerSizePanel
  | GLLegendStepPanel
  | GLLegendSimpleSymbolPanel
  | GLLegendFilterPanel;

export type SimpleLegendForGLLayers = {
  type: "SimpleGLLegend";
  symbol: GLLegendSymbol;
};

export type MultipleSymbolLegendForGLLayers = {
  type: "MultipleSymbolGLLegend";
  panels: GLLegendPanel[];
};

export type LegendForGLLayers =
  | SimpleLegendForGLLayers
  | MultipleSymbolLegendForGLLayers;
