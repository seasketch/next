import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCTS,
  PRODUCT_IDS,
  archiveFilename,
  bandIds,
  defaultDailyEnd,
  defaultEndYear,
  displayKey,
  periodsFor,
  r2Key,
  requireProduct,
  sourceUrl,
  yearsFor,
} from "./products";

describe("CRW products", () => {
  it("registers annual products plus daily DHW", () => {
    assert.deepEqual(PRODUCT_IDS, [
      "dhw-max",
      "dhw-max-q",
      "dhw-daily",
      "dhw-weekly",
      "dhw-weekly-b",
      "dhw-weekly-all",
      "dhw-weekly-24",
      "baa-max",
      "baa-weekly-24",
      "ssta-mean",
      "ssta-weekly-24",
      "sst-mean",
      "sst-weekly-24",
    ]);
    assert.equal(PRODUCTS["dhw-max"].startYear, 1986);
    assert.equal(PRODUCTS["dhw-daily"].cadence, "day");
    assert.equal(PRODUCTS["dhw-daily"].windowDays, 365);
    assert.equal(PRODUCTS["dhw-daily"].bandsPerBlock, 30);
    assert.equal(PRODUCTS["dhw-daily"].scale, 0.1);
    assert.deepEqual(PRODUCTS["dhw-daily"].filters, ["delta", "zigzag"]);
    assert.equal(PRODUCTS["dhw-max"].bandsPerBlock, 8);
    assert.equal(PRODUCTS["baa-max"].bandsPerBlock, 64);
    assert.equal(PRODUCTS["baa-max"].startYear, 1986);
    assert.equal(PRODUCTS["ssta-mean"].startYear, 1985);
    assert.equal(PRODUCTS["sst-mean"].startYear, 1985);
    assert.equal(PRODUCTS["dhw-max"].scale, 0.01);
    assert.equal(PRODUCTS["dhw-max-q"].scale, 0.1);
    assert.equal(PRODUCTS["dhw-max-q"].aliasOf, "dhw-max");
    assert.equal(PRODUCTS["dhw-weekly"].cadence, "week");
    assert.equal(PRODUCTS["dhw-weekly"].sampleEveryDays, 7);
    assert.equal(PRODUCTS["dhw-weekly"].aliasOf, "dhw-daily");
    assert.equal(PRODUCTS["dhw-weekly"].reuseStack, false);
    assert.equal(PRODUCTS["dhw-weekly-b"].bandsPerBlock, 8);
    assert.equal(PRODUCTS["dhw-weekly-b"].aliasOf, "dhw-weekly");
    assert.equal(PRODUCTS["dhw-weekly-all"].startYear, 1986);
    assert.equal(PRODUCTS["dhw-weekly-all"].bandsPerBlock, 8);
    assert.equal(PRODUCTS["dhw-weekly-all"].reuseDownloadsOf, "dhw-daily");
    assert.equal(PRODUCTS["dhw-weekly-24"].windowDays, 728);
    assert.equal(PRODUCTS["dhw-weekly-24"].bandsPerBlock, 16);
    assert.equal(PRODUCTS["baa-weekly-24"].windowDays, 728);
    assert.equal(PRODUCTS["baa-weekly-24"].reuseOccupancyOf, "baa-max");
    assert.equal(PRODUCTS["ssta-weekly-24"].reuseOccupancyOf, "ssta-mean");
    assert.equal(PRODUCTS["sst-weekly-24"].dailyFilenamePrefix, "coraltemp");
    assert.equal(PRODUCTS["sst-weekly-24"].variable, "analysed_sst");
    assert.equal(PRODUCTS["sst-weekly-24"].reuseOccupancyOf, "sst-mean");
    assert.equal(PRODUCTS["ssta-mean"].offset, -15);
  });

  it("builds deterministic NOAA annual URLs", () => {
    assert.equal(
      sourceUrl(requireProduct("dhw-max"), "2024"),
      "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/annual/ct5km_dhw-max_v3.1_2024.nc",
    );
  });

  it("builds deterministic NOAA daily DHW URLs", () => {
    assert.equal(
      sourceUrl(requireProduct("dhw-daily"), "2026-09-03"),
      "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/dhw/2026/ct5km_dhw_v3.1_20260903.nc",
    );
  });

  it("builds daily URLs for the other 24-month weekly products", () => {
    assert.equal(
      sourceUrl(requireProduct("baa-weekly-24"), "2026-09-03"),
      "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/baa/2026/ct5km_baa_v3.1_20260903.nc",
    );
    assert.equal(
      sourceUrl(requireProduct("ssta-weekly-24"), "2026-09-03"),
      "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/ssta/2026/ct5km_ssta_v3.1_20260903.nc",
    );
    assert.equal(
      sourceUrl(requireProduct("sst-weekly-24"), "2026-09-03"),
      "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/sst/2026/coraltemp_v3.1_20260903.nc",
    );
  });

  it("uses last complete calendar year as the default annual end", () => {
    assert.equal(defaultEndYear(new Date("2026-09-04T00:00:00Z")), 2025);
    const years = yearsFor(requireProduct("dhw-max"), 1986, 2025);
    assert.equal(years[0], 1986);
    assert.equal(years[years.length - 1], 2025);
    assert.equal(years.length, 40);
    assert.deepEqual(bandIds(years).slice(0, 2), ["1986", "1987"]);
  });

  it("defaults daily DHW to a 365-day window ending yesterday UTC", () => {
    assert.equal(defaultDailyEnd(new Date("2026-09-04T15:00:00Z")), "2026-09-03");
    const days = periodsFor(requireProduct("dhw-daily"), undefined, "2026-09-03");
    assert.equal(days[0], "2025-09-04");
    assert.equal(days[days.length - 1], "2026-09-03");
    assert.equal(days.length, 365);
  });

  it("samples 52 weeks from a 364-day window ending on the last day", () => {
    const weeks = periodsFor(requireProduct("dhw-weekly"), undefined, "2026-09-03");
    assert.equal(weeks.length, 52);
    assert.equal(weeks[0], "2025-09-11");
    assert.equal(weeks[weeks.length - 1], "2026-09-03");
    assert.equal(weeks[weeks.length - 2], "2026-08-27");
  });

  it("samples 104 weeks from a 728-day window ending on the last day", () => {
    const weeks = periodsFor(
      requireProduct("dhw-weekly-24"),
      undefined,
      "2026-09-03",
    );
    assert.equal(weeks.length, 104);
    assert.equal(weeks[0], "2024-09-12");
    assert.equal(weeks[weeks.length - 1], "2026-09-03");
    assert.deepEqual(
      periodsFor(requireProduct("baa-weekly-24"), undefined, "2026-09-03"),
      weeks,
    );
    assert.deepEqual(
      periodsFor(requireProduct("ssta-weekly-24"), undefined, "2026-09-03"),
      weeks,
    );
    assert.deepEqual(
      periodsFor(requireProduct("sst-weekly-24"), undefined, "2026-09-03"),
      weeks,
    );
  });

  it("samples weekly DHW from 1986-01-01 through the given end date", () => {
    const weeks = periodsFor(
      requireProduct("dhw-weekly-all"),
      undefined,
      "2026-09-03",
    );
    assert.equal(weeks.length, 2123);
    assert.equal(weeks[0], "1986-01-02");
    assert.equal(weeks[weeks.length - 1], "2026-09-03");
  });

  it("names v1 archives under dataLibrary/", () => {
    const product = requireProduct("dhw-max");
    assert.equal(archiveFilename(product), "crw-dhw-max-v1.pmtiles");
    assert.equal(r2Key(product), "dataLibrary/crw-dhw-max-v1.pmtiles");
    assert.equal(displayKey(product), "dataLibrary/crw-dhw-max-v1");
    assert.equal(
      archiveFilename(requireProduct("dhw-daily")),
      "crw-dhw-daily-v1.pmtiles",
    );
  });
});
