import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cellsMeetingBox } from "../scripts/catalog.js";

const CATALOG = `<?xml version="1.0"?>
<EncProductCatalog>
  <cell>
    <name>US4CA1GP</name>
    <lname>East Santa Cruz Island</lname>
    <status>Active</status>
    <zipfile_location>https://charts.noaa.gov/ENCs/US4CA1GP.zip</zipfile_location>
    <zipfile_size>100</zipfile_size>
    <cov><panel><vertex><lat>33.9</lat><long>-119.7</long></vertex>
    <vertex><lat>34.2</lat><long>-119.4</long></vertex></panel></cov>
  </cell>
  <cell>
    <name>US5GONE</name>
    <lname>Cancelled harbour</lname>
    <status>Cancelled</status>
    <zipfile_location>https://charts.noaa.gov/ENCs/US5GONE.zip</zipfile_location>
    <cov><panel><vertex><lat>34.0</lat><long>-119.5</long></vertex>
    <vertex><lat>34.1</lat><long>-119.4</long></vertex></panel></cov>
  </cell>
  <cell>
    <name>US3FAR</name>
    <lname>Well east of the channel</lname>
    <status>Active</status>
    <zipfile_location>https://charts.noaa.gov/ENCs/US3FAR.zip</zipfile_location>
    <cov><panel><vertex><lat>34.0</lat><long>-118.0</long></vertex>
    <vertex><lat>34.2</lat><long>-117.5</long></vertex></panel></cov>
  </cell>
  <cell>
    <name>US4EDGE</name>
    <lname>Touches the box along its east side</lname>
    <status>Active</status>
    <zipfile_location>https://charts.noaa.gov/ENCs/US4EDGE.zip</zipfile_location>
    <cov><panel><vertex><lat>34.0</lat><long>-119.15</long></vertex>
    <vertex><lat>34.2</lat><long>-119.0</long></vertex></panel></cov>
  </cell>
</EncProductCatalog>`;

const CLIP: [number, number, number, number] = [-120.55, 33.85, -119.15, 34.48];

describe("NOAA ENC catalog", () => {
  it("keeps active cells whose coverage overlaps the channel box", () => {
    const cells = cellsMeetingBox(CATALOG, CLIP);
    assert.deepEqual(
      cells.map((cell) => cell.name),
      ["US4CA1GP"]
    );
    assert.equal(cells[0].url, "https://charts.noaa.gov/ENCs/US4CA1GP.zip");
    assert.equal(cells[0].bytes, 100);
    assert.equal(cells[0].title, "East Santa Cruz Island");
  });

  it("returns nothing for an empty catalog", () => {
    assert.deepEqual(cellsMeetingBox("<EncProductCatalog></EncProductCatalog>", CLIP), []);
  });
});
