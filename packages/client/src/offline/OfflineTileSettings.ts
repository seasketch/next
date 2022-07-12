import { Feature, MultiPolygon, Polygon } from "geojson";

export type SimpleOfflineTileSettings = {
  region: Feature<Polygon | MultiPolygon>;
  maxZ: number;
};

export type DetailedShorelineOfflineTileSettings = SimpleOfflineTileSettings & {
  maxShorelineZ: number;
  levelOfDetail: 0 | 1 | 2;
};

export type OfflineTileSettings =
  | SimpleOfflineTileSettings
  | DetailedShorelineOfflineTileSettings;

export function isDetailedShorelineSetting(
  settings: OfflineTileSettings
): settings is DetailedShorelineOfflineTileSettings {
  return (
    (settings as DetailedShorelineOfflineTileSettings).maxShorelineZ !==
    undefined
  );
}
