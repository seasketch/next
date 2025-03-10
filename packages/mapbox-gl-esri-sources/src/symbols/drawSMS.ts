import { SimpleFillSymbol, SimpleMarkerSymbol } from "arcgis-rest-api";
import { createCanvas, rgba, ptToPx } from "./utils";
import { CANVAS_TO_DATA_URL } from "../ImageList";

/** @hidden */
export default function (symbol: SimpleMarkerSymbol, pixelRatio: 1 | 2 | 3) {
  const size = ptToPx(symbol.size || 13);
  const scale = 2 ** (pixelRatio - 1);
  const padding = 1;
  const width = (size + 1 * 2 + (symbol.outline?.width || 0) * 2) * scale;
  const height = width;
  let canvas = createCanvas(width, height);
  var ctx = canvas.getContext("2d")!;
  ctx.lineWidth =
    ptToPx(!!symbol.outline ? symbol.outline.width || 1 : 1) * scale;
  ctx.strokeStyle = !!symbol.outline
    ? rgba(symbol.outline?.color)
    : rgba(symbol.color);
  ctx.fillStyle = rgba(symbol.color);
  switch (symbol.style) {
    case "esriSMSCircle":
      // canvas.style = "image-rendering: pixelated;";
      // ctx.imageSmoothingEnabled = false;
      ctx.beginPath();
      var x = width / 2;
      var y = height / 2;
      var diameter = size * scale;
      // I have no idea why, but adding a bit here helps match arcgis server output a bit better
      var radius = Math.round((diameter + ctx.lineWidth) / 2);
      ctx.arc(x, y, radius, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.stroke();
      break;
    case "esriSMSCross":
      var w = size * scale;
      ctx.lineWidth = Math.round(w / 4);
      ctx.strokeStyle = rgba(symbol.color);
      ctx.moveTo(width / 2, (height - w) / 2);
      ctx.lineTo(width / 2, height - (height - w) / 2);
      ctx.moveTo((width - w) / 2, height / 2);
      ctx.lineTo(width - (width - w) / 2, height / 2);
      ctx.stroke();
      ctx.fill();
      break;
    case "esriSMSX":
      var w = size * scale;
      ctx.translate(width / 2, height / 2);
      ctx.rotate((45 * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
      ctx.moveTo(width / 2, (height - w) / 2);
      ctx.lineTo(width / 2, height - (height - w) / 2);
      ctx.moveTo((width - w) / 2, height / 2);
      ctx.lineTo(width - (width - w) / 2, height / 2);
      ctx.stroke();
      ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      break;
    case "esriSMSDiamond":
      var w = size * scale;
      var h = w;
      var x = width / 2 - w / 2;
      var y = height / 2 - h / 2;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((45 * Math.PI) / 180);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    case "esriSMSSquare":
      var w = size * scale;
      var h = w;
      var x = width / 2 - w / 2;
      var y = height / 2 - h / 2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      break;
    case "esriSMSTriangle":
      ctx.beginPath();
      var w = size * scale;
      var h = w;
      var midpoint = width / 2;
      var x1 = midpoint;
      var y1 = (height - width) / 2;
      var x2 = width - (width - width) / 2;
      var y2 = height - (height - width) / 2;
      var x3 = (width - width) / 2;
      var y3 = height - (height - width) / 2;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x1, y1);
      ctx.fill();
      ctx.stroke();
      break;
    default:
      throw new Error(`Unknown symbol type ${symbol.style}`);
  }
  const data = CANVAS_TO_DATA_URL(canvas);
  console.log("canvas data", data);
  return { width, height, data };
}
