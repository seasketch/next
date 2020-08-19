import { createCanvas } from "./utils";
export default {
    esriSFSVertical: (strokeStyle = "#000000") => {
        var canvas = createCanvas(16, 16);
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = strokeStyle || "#000000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8, 16);
        ctx.stroke();
        return ctx.createPattern(canvas, "repeat");
    },
    esriSFSHorizontal: (strokeStyle = "#000000") => {
        var canvas = createCanvas(16, 16);
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = strokeStyle || "#000000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(16, 8);
        ctx.stroke();
        return ctx.createPattern(canvas, "repeat");
    },
    esriSFSBackwardDiagonal: (strokeStyle = "#000000") => {
        var canvas = createCanvas(16, 16);
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 24);
        ctx.lineTo(24, 0);
        ctx.stroke();
        return ctx.createPattern(canvas, "repeat");
    },
    esriSFSForwardDiagonal: (strokeStyle = "#000000") => {
        var canvas = createCanvas(16, 16);
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(8, 16);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(16, 8);
        ctx.stroke();
        return ctx.createPattern(canvas, "repeat");
    },
    esriSFSCross: (strokeStyle = "#000000") => {
        var canvas = createCanvas(16, 16);
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(16, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8, 16);
        ctx.stroke();
        return ctx.createPattern(canvas, "repeat");
    },
    esriSFSDiagonalCross: (strokeStyle = "#000000") => {
        var canvas = createCanvas(16, 16);
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(8, 16);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(16, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 24);
        ctx.lineTo(24, 0);
        ctx.stroke();
        return ctx.createPattern(canvas, "repeat");
    },
};
