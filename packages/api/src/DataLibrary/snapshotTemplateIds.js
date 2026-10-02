// Data-library templates that snapshots/data-library.sql hardcodes into the
// golden snapshot, with their production data_upload_outputs.
// snapshot-create.sh refuses to write a dump whose seed inserts a different
// set. Plain CommonJS so the snapshot scripts can read it without a build.
const SNAPSHOT_DATA_LIBRARY_TEMPLATE_IDS = [
  "DAYLIGHT_COASTLINE",
  "MARINE_REGIONS_EEZ_LAND_JOINED",
  "MARINE_REGIONS_HIGH_SEAS",
  "MARINE_REGIONS_TERRITORIAL_SEA",
  "SEAMOUNTS",
];

module.exports = { SNAPSHOT_DATA_LIBRARY_TEMPLATE_IDS };
