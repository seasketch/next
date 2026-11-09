/* eslint-disable i18next/no-literal-string */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import AttributeSelect, { attributeExampleText } from "./AttributeSelect";

function column(partial: Record<string, unknown>): GeostatsAttribute {
  return {
    attribute: "abundance",
    type: "number",
    count: 0,
    values: {},
    ...partial,
  } as GeostatsAttribute;
}

describe("attributeExampleText", () => {
  it("does not throw when a numeric column stored null min and max", () => {
    const empty = column({
      attribute: "biomass",
      min: null,
      max: null,
    });
    expect(attributeExampleText(empty)).toBeNull();
  });

  it("shows sample values when the range is null but a histogram exists", () => {
    expect(
      attributeExampleText(
        column({
          attribute: "cover",
          min: null,
          max: null,
          count: 2,
          values: { "0": 1, "10": 4 },
        })
      )
    ).toBe("0, 10");
  });

  it("formats a finite range, including a minimum of zero", () => {
    expect(
      attributeExampleText(
        column({
          min: 0,
          max: 12.5,
          count: 4,
          values: { "0": 1, "12.5": 1 },
        })
      )
    ).toBe(`${(0).toLocaleString()} - ${(12.5).toLocaleString()}`);
  });

  it("ignores a null bound on one side of the range", () => {
    expect(
      attributeExampleText(
        column({
          min: 1,
          max: null,
          values: { "1": 2 },
        })
      )
    ).toBe("1");
  });

  it("lists string samples", () => {
    expect(
      attributeExampleText(
        column({
          attribute: "scientificname",
          type: "string",
          count: 2,
          values: { "Zostera marina": 3, Ulva: 1 },
        })
      )
    ).toBe("Zostera marina, Ulva");
  });
});

describe("AttributeSelect", () => {
  it("opens the column menu when a numeric attribute has a null range", () => {
    render(
      <AttributeSelect
        attributes={[
          column({ attribute: "biomass", min: null, max: null }),
          column({
            attribute: "abundance",
            count: 2,
            min: 1,
            max: 4,
            values: { "1": 1, "4": 1 },
          }),
        ]}
        onChange={() => {}}
        placeholder="Select a column"
      />
    );

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("option", { name: "biomass" })).toBeTruthy();
    expect(screen.getByRole("option", { name: /abundance/ }).textContent).toContain(
      `${(1).toLocaleString()} - ${(4).toLocaleString()}`
    );
  });
});
