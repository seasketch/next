/** @hidden */
export default {
  esriSFSVertical: (ctx, strokeStyle = "#000000") => {
    ctx.strokeStyle = strokeStyle || "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.lineTo(8, 20);
    ctx.stroke();
  },
  esriSFSHorizontal: (ctx, strokeStyle = "#000000") => {
    ctx.strokeStyle = strokeStyle || "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(20, 8);
    ctx.stroke();
  },
  esriSFSBackwardDiagonal: (ctx, strokeStyle = "#000000") => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, 9);
    ctx.lineTo(9, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(17, 7);
    ctx.lineTo(7, 17);
    ctx.stroke();
  },
  esriSFSForwardDiagonal: (ctx, strokeStyle = "#000000") => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, 7);
    ctx.lineTo(9, 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, -1);
    ctx.lineTo(17, 9);
    ctx.stroke();
  },
  esriSFSCross: (ctx, strokeStyle = "#000000") => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, 8);
    ctx.lineTo(17, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -1);
    ctx.lineTo(8, 17);
    ctx.stroke();
  },
  esriSFSDiagonalCross: (ctx, strokeStyle = "#000000") => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, 7);
    ctx.lineTo(9, 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, -1);
    ctx.lineTo(17, 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1, 9);
    ctx.lineTo(9, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, 17);
    ctx.lineTo(17, 7);
    ctx.stroke();
  },
} as {
  [key: string]: PatternFn;
};

export type PatternFn = (
  ctx: CanvasRenderingContext2D,
  strokeStyle: string
) => void;
