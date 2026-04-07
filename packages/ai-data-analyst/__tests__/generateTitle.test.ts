/**
 * Live calls to the gateway in `generateTitle` (no mocks).
 * Loads `.env` from this package via `vitest.config.ts` (Vite `loadEnv`).
 */
import { describe, expect, it } from "vitest";
import { generateTitle } from "../lib/client";

describe.concurrent("generateTitle", () => {
  it('formats "0-12nm_teritorial_Sea.geojson.json" -> "0-12(nm|NM) Territorial Sea"', async () => {
    const response = await generateTitle("0-12nm_teritorial_Sea.geojson.json");
    expect("error" in response).toBe(false);
    expect("title" in response).toBe(true);
    if (!("title" in response)) {
      throw new Error("title not in response");
    }
    const title = response.title;
    expect(title).toMatch(/^0[-–]12\s*[nN][mM] Ter[r]*itorial Sea$/);
  });

  it('formats "Mangrove-Planting.geojson (1).json" -> "Mangrove Planting"', async () => {
    const result = await generateTitle("Mangrove-Planting.geojson (1).json");
    expect(result).toMatchObject({
      title: "Mangrove Planting",
    });
  });

  it('formats "20250213_Fiji_2023_Expedition_Sites.json" -> "2025-02-13 Fiji 2023 Expedition Sites"', async () => {
    const result = await generateTitle(
      "20250213_Fiji_2023_Expedition_Sites.json",
    );
    expect(result).toMatchObject({
      title: expect.stringMatching(
        /2025[\-\s]*02[\-\s]*13 Fiji 2023 Expedition Sites/,
      ),
    });
  });

  it('formats "Revised_Deepwater_Bioregions_Fj.zip" -> "Revised Deepwater Bioregions Fj"', async () => {
    const result = await generateTitle("Revised_Deepwater_Bioregions_Fj.zip");
    expect(result).toMatchObject({
      title: expect.stringMatching(/^Revised Deepwater Bioregions F[Jj]$/),
    });
  });
});
