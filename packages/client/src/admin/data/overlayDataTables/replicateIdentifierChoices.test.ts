import { describe, expect, it } from "@jest/globals";
import { replicateIdentifierChoices } from "./replicateIdentifierChoices";

describe("replicateIdentifierChoices", () => {
  const columns = [
    "comments",
    "debriscategory",
    "quadrat",
    "resulttotal",
    "stationno",
    "transect",
  ];

  it("keeps integer identifier columns such as quadrat and transect", () => {
    const choices = replicateIdentifierChoices({
      columns,
      joinColumn: "siteid",
      valueColumns: ["resulttotal"],
      identifiers: [],
    });
    expect(choices).toEqual([
      "comments",
      "debriscategory",
      "quadrat",
      "stationno",
      "transect",
    ]);
  });

  it("leaves out the join column and configured value columns", () => {
    const choices = replicateIdentifierChoices({
      columns: [...columns, "siteid"],
      joinColumn: "siteid",
      valueColumns: ["resulttotal"],
      identifiers: [],
    });
    expect(choices).not.toContain("siteid");
    expect(choices).not.toContain("resulttotal");
  });

  it("keeps numeric columns when no value column is configured", () => {
    const choices = replicateIdentifierChoices({
      columns,
      joinColumn: "siteid",
      valueColumns: [],
      identifiers: [],
    });
    expect(choices).toContain("resulttotal");
    expect(choices).toContain("quadrat");
  });

  it("always shows saved identifiers so they can be unchecked", () => {
    const choices = replicateIdentifierChoices({
      columns: ["comments"],
      joinColumn: "siteid",
      valueColumns: ["transect"],
      identifiers: ["transect", "zone"],
    });
    expect(choices).toEqual(["comments", "transect", "zone"]);
  });

  it("never offers the join column even when saved as an identifier", () => {
    const choices = replicateIdentifierChoices({
      columns: ["a"],
      joinColumn: "site",
      valueColumns: [],
      identifiers: ["site"],
    });
    expect(choices).toEqual(["a"]);
  });
});
