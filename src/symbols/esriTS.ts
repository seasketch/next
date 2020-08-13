import { ptToPx, toTextAnchor, rgba, generateId } from "./utils";
import { Layer } from "mapbox-gl";

export default (
  labelingInfo: any,
  geometryType: "line" | "point",
  fieldNames: string[]
) => {
  // TODO: Support scale-dependant rendering. Right now just taking first label
  // TODO: labelExpressions (full Arcade!?)
  // TODO: where expressions
  // TODO: xoffset, yoffset, kerning, angle, rightToLeft, horizontalAlignment, etc
  // See https://developers.arcgis.com/documentation/common-data-types/labeling-objects.htm
  return {
    id: generateId(),
    type: "symbol",
    layout: {
      // TODO: properly support labeling functions like UCASE(), CONCAT(), etc
      // https://developers.arcgis.com/documentation/common-data-types/labeling-objects.htm
      "text-field": toExpression(labelingInfo.labelExpression, fieldNames),
      // Only supports points right now
      "text-anchor": toTextAnchor(labelingInfo.labelPlacement),
      "text-size": ptToPx(labelingInfo.symbol.font.size || 13),
      "symbol-placement": geometryType === "line" ? "line" : "point",
      "text-max-angle": 20,
    },
    paint: {
      "text-color": rgba(labelingInfo.symbol.color),
      "text-halo-width": ptToPx(labelingInfo.symbol.haloSize || 0),
      "text-halo-color": rgba(
        labelingInfo.symbol.haloColor || [255, 255, 255, 255]
      ),
      "text-halo-blur": ptToPx(labelingInfo.symbol.haloSize || 0) * 0.5,
    },
  } as Layer;
};

function toExpression(labelExpression: string, fieldNames: string[]) {
  const fields = (labelExpression.match(/\[\w+\]/g) || [])
    .map((val) => val.replace(/[\[\]]/g, ""))
    .map(
      (val) =>
        fieldNames.find((name) => name.toLowerCase() === val.toLowerCase())!
    );
  const strings = labelExpression.split(/\[\w+\]/g);
  const expression: any[] = ["format"];
  while (strings.length) {
    expression.push(strings.shift()!);
    const field = fields.shift();
    if (field) {
      expression.push(["get", field]);
    }
  }
  return expression;
}
