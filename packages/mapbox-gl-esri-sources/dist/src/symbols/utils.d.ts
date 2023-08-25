/** @hidden */
declare type RGBA = [number, number, number, number];
/** @hidden */
export declare function generateId(): string;
/** @hidden */
export declare function createCanvas(w: number, h: number): HTMLCanvasElement;
/** @hidden */
export declare const rgba: (color?: RGBA | undefined) => string;
/** @hidden */
export declare const colorAndOpacity: (color?: RGBA | undefined) => {
    color: string;
    opacity: number;
};
/** @hidden */
export declare const ptToPx: (pt: number) => number;
/** @hidden */
export declare const toTextAnchor: (labelPlacement: string) => string;
export {};
