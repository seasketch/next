"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inferCsvColumnPlans_1 = require("./inferCsvColumnPlans");
describe("decideNaNullHandling", () => {
    test("numeric column with R-style NA missing values", () => {
        expect((0, inferCsvColumnPlans_1.decideNaNullHandling)("VARCHAR", "BIGINT", 19)).toEqual({ duckDbType: "BIGINT", nullifyNa: true });
    });
    test("string column with literal NA species code", () => {
        expect((0, inferCsvColumnPlans_1.decideNaNullHandling)("VARCHAR", "VARCHAR", 1)).toEqual({ duckDbType: "VARCHAR", nullifyNa: false });
    });
    test("already numeric without NA strings", () => {
        expect((0, inferCsvColumnPlans_1.decideNaNullHandling)("BIGINT", "BIGINT", 0)).toEqual({ duckDbType: "BIGINT", nullifyNa: true });
    });
    test("varchar with no NA literals", () => {
        expect((0, inferCsvColumnPlans_1.decideNaNullHandling)("VARCHAR", "VARCHAR", 0)).toEqual({ duckDbType: "VARCHAR", nullifyNa: true });
    });
});
describe("isNumericDuckDbType", () => {
    test("recognizes numeric duckdb types", () => {
        expect((0, inferCsvColumnPlans_1.isNumericDuckDbType)("BIGINT")).toBe(true);
        expect((0, inferCsvColumnPlans_1.isNumericDuckDbType)("DOUBLE")).toBe(true);
        expect((0, inferCsvColumnPlans_1.isNumericDuckDbType)("VARCHAR")).toBe(false);
    });
});
