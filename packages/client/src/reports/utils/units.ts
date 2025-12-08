export function convertSquareKilometersToUnit(
  sqKm: number,
  unit: "hectare" | "acre" | "mile"
) {
  if (unit === "hectare") {
    return sqKm * 100;
  } else if (unit === "acre") {
    return sqKm * 247.105381;
  } else if (unit === "mile") {
    return sqKm * 0.386102;
  }
  return sqKm;
}
