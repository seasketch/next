/* eslint-disable i18next/no-literal-string */
import { fromText, toText } from "./FormElementOptionsInput";

const t = (key: string) => key;

test("labels with commas stay quoted when options are shown again", () => {
  const { options, errors } = fromText(
    `"Snorkeling, freediving",snorkel\nFishing,fishing`,
    t
  );
  expect(errors).toEqual([]);
  expect(options[0].label).toBe("Snorkeling, freediving");
  const text = toText(options);
  expect(text.split(/\r?\n/)[0]).toBe(`"Snorkeling, freediving",snorkel`);
  expect(fromText(text, t).options).toEqual(options);
});

test("values and descriptions with commas round trip", () => {
  const options = [
    { label: "Reef", value: "reef, outer", description: "Forereef, slope" },
    { label: "Lagoon" },
  ];
  expect(fromText(toText(options), t).options).toEqual([
    { label: "Reef", value: "reef, outer", description: "Forereef, slope" },
    { label: "Lagoon" },
  ]);
});

test("plain options are written without quotes", () => {
  expect(
    toText([
      { label: "North", value: "N" },
      { label: "South", value: "S" },
    ]).split(/\r?\n/)
  ).toEqual(["North,N", "South,S"]);
});
