import { SimpleMarkerSymbol } from "arcgis-rest-api";
export default function (symbol: SimpleMarkerSymbol, pixelRatio: 1 | 2 | 3): {
    width: number;
    height: number;
    data: string;
};
