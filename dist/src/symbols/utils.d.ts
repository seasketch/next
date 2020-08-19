declare type RGBA = [number, number, number, number];
export declare function generateId(): string;
export declare function createCanvas(w: number, h: number): HTMLCanvasElement;
export declare const rgba: (color?: RGBA | undefined) => string;
export declare const colorAndOpacity: (color?: RGBA | undefined) => {
    color: string;
    opacity: number;
};
export declare const ptToPx: (pt: number) => number;
export declare const toTextAnchor: (labelPlacement: string) => string;
export {};
