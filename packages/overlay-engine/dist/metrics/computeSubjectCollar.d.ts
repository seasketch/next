import { Feature, MultiPolygon, Polygon } from "geojson";
/**
 * Computes the buffered subject and its boundary **collar** used for
 * buffered fragment `overlay_area` overlap detection.
 *
 * Collar = `buffer(subject, d) − erode(subject, d)`. When erode yields an
 * empty geometry (fragment thinner than 2d), the collar is the whole buffer.
 *
 * Called only when `bufferDistanceKm > 0` on a fragment subject. Unbuffered
 * `overlay_area` never invokes this helper.
 *
 * @see OverlayAreaOverlapInfo in `./metrics` for how collar metadata is used.
 */
export declare function computeBufferedSubjectAndCollar(subject: Feature<Polygon | MultiPolygon>, bufferKm: number): {
    buffered: Feature<Polygon | MultiPolygon>;
    collar: Feature<Polygon | MultiPolygon>;
    bbox: [number, number, number, number];
};
//# sourceMappingURL=computeSubjectCollar.d.ts.map