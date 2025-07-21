import { GeostatsLayer } from "./geostats";
export declare function statsFromMBTiles(mbtilesPath: string): Promise<{
    geostats: GeostatsLayer | null;
    bounds: any;
}>;
