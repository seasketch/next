import { SeaSketchSourceBaseOptions } from "./Base";

export type WMSSource = {
  type: "WMSSource";
  options: any;
} & SeaSketchSourceBaseOptions;
