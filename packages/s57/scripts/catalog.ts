/**
 * The NOAA ENC product catalog is one `<cell>` per chart. Coverage is a list
 * of `<panel>` rings. A panel meets the demo box when their rectangles overlap.
 */

export type CatalogCell = {
  name: string;
  title: string;
  url: string;
  bytes: number;
};

type Box = [number, number, number, number];

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return match ? match[1].trim() : "";
}

function panelBoxes(block: string): Box[] {
  const boxes: Box[] = [];
  const panels = block.split("<panel>").slice(1);
  for (const panel of panels) {
    const body = panel.split("</panel>")[0];
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    const vertices = body.matchAll(/<lat>([^<]+)<\/lat>\s*<long>([^<]+)<\/long>/g);
    for (const vertex of vertices) {
      const lat = Number(vertex[1]);
      const lon = Number(vertex[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    if (west <= east && south <= north) boxes.push([west, south, east, north]);
  }
  return boxes;
}

function boxesMeet(cell: Box, clip: Box): boolean {
  return cell[0] < clip[2] && cell[2] > clip[0] && cell[1] < clip[3] && cell[3] > clip[1];
}

/** Active cells in catalog order. Cancelled cells and cells without a zip are skipped. */
export function cellsInCatalog(xml: string): Array<CatalogCell & { panels: Box[] }> {
  const cells: Array<CatalogCell & { panels: Box[] }> = [];
  for (const part of xml.split("<cell>").slice(1)) {
    const block = part.split("</cell>")[0];
    if (tag(block, "status") !== "Active") continue;
    const name = tag(block, "name");
    const url = tag(block, "zipfile_location");
    if (!name || !url) continue;
    const bytes = Number(tag(block, "zipfile_size"));
    cells.push({
      name,
      title: tag(block, "lname"),
      url,
      bytes: Number.isFinite(bytes) ? bytes : 0,
      panels: panelBoxes(block),
    });
  }
  return cells;
}

/** Active cells whose coverage rectangle overlaps `clip` (west, south, east, north). */
export function cellsMeetingBox(xml: string, clip: Box): CatalogCell[] {
  return cellsInCatalog(xml)
    .filter((cell) => cell.panels.some((panel) => boxesMeet(panel, clip)))
    .map(({ name, title, url, bytes }) => ({ name, title, url, bytes }));
}
