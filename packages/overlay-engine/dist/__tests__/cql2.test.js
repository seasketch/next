"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const cql2_1 = require("../src/cql2");
(0, vitest_1.describe)("evaluateCql2JSONQuery", () => {
    (0, vitest_1.describe)("equality operators", () => {
        (0, vitest_1.it)("should evaluate = operator correctly", () => {
            const properties = { name: "test", age: 25 };
            // String equality
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "=",
                args: [{ property: "name" }, "test"],
            }, properties)).toBe(true);
            // Number equality
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "=",
                args: [{ property: "age" }, 25],
            }, properties)).toBe(true);
            // Non-matching values
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "=",
                args: [{ property: "name" }, "wrong"],
            }, properties)).toBe(false);
        });
        (0, vitest_1.it)("should evaluate != operator correctly", () => {
            const properties = { name: "test", age: 25 };
            // String inequality
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "!=",
                args: [{ property: "name" }, "wrong"],
            }, properties)).toBe(true);
            // Number inequality
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "!=",
                args: [{ property: "age" }, 30],
            }, properties)).toBe(true);
            // Matching values should return false
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "!=",
                args: [{ property: "name" }, "test"],
            }, properties)).toBe(false);
        });
    });
    (0, vitest_1.describe)("in operator", () => {
        (0, vitest_1.it)("should evaluate in operator correctly", () => {
            const properties = { name: "test", age: 25, tags: ["a", "b"] };
            // String in array
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "in",
                args: [{ property: "name" }, ["test", "other"]],
            }, properties)).toBe(true);
            // Number in array
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "in",
                args: [{ property: "age" }, [25, 30, 35]],
            }, properties)).toBe(true);
            // Value not in array
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "in",
                args: [{ property: "name" }, ["wrong", "other"]],
            }, properties)).toBe(false);
            // Non-array value should return false
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "in",
                args: [{ property: "name" }, "test"],
            }, properties)).toBe(false);
        });
    });
    (0, vitest_1.describe)("logical operators", () => {
        (0, vitest_1.it)("should evaluate and operator correctly", () => {
            const properties = { name: "test", age: 25 };
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                and: [
                    { op: "=", args: [{ property: "name" }, "test"] },
                    { op: "=", args: [{ property: "age" }, 25] },
                ],
            }, properties)).toBe(true);
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                and: [
                    { op: "=", args: [{ property: "name" }, "test"] },
                    { op: "=", args: [{ property: "age" }, 30] },
                ],
            }, properties)).toBe(false);
        });
        (0, vitest_1.it)("should evaluate and operator in op/args format", () => {
            const properties = { name: "test", age: 25 };
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "and",
                args: [
                    { op: "=", args: [{ property: "name" }, "test"] },
                    { op: "=", args: [{ property: "age" }, 25] },
                ],
            }, properties)).toBe(true);
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "and",
                args: [
                    { op: "=", args: [{ property: "name" }, "test"] },
                    { op: "=", args: [{ property: "age" }, 30] },
                ],
            }, properties)).toBe(false);
        });
        (0, vitest_1.it)("should evaluate or operator correctly", () => {
            const properties = { name: "test", age: 25 };
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                or: [
                    { op: "=", args: [{ property: "name" }, "wrong"] },
                    { op: "=", args: [{ property: "age" }, 25] },
                ],
            }, properties)).toBe(true);
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                or: [
                    { op: "=", args: [{ property: "name" }, "wrong"] },
                    { op: "=", args: [{ property: "age" }, 30] },
                ],
            }, properties)).toBe(false);
        });
        (0, vitest_1.it)("should evaluate or operator in op/args format", () => {
            const properties = { name: "test", age: 25 };
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "or",
                args: [
                    { op: "=", args: [{ property: "name" }, "wrong"] },
                    { op: "=", args: [{ property: "age" }, 25] },
                ],
            }, properties)).toBe(true);
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "or",
                args: [
                    { op: "=", args: [{ property: "name" }, "wrong"] },
                    { op: "=", args: [{ property: "age" }, 30] },
                ],
            }, properties)).toBe(false);
        });
        (0, vitest_1.it)("should evaluate nested logical operators", () => {
            const properties = { name: "test", age: 25, role: "admin" };
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "and",
                args: [
                    { op: "=", args: [{ property: "name" }, "test"] },
                    {
                        op: "or",
                        args: [
                            { op: "=", args: [{ property: "age" }, 25] },
                            { op: "=", args: [{ property: "role" }, "admin"] },
                        ],
                    },
                ],
            }, properties)).toBe(true);
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                op: "and",
                args: [
                    { op: "=", args: [{ property: "name" }, "test"] },
                    {
                        op: "or",
                        args: [
                            { op: "=", args: [{ property: "age" }, 30] },
                            { op: "=", args: [{ property: "role" }, "user"] },
                        ],
                    },
                ],
            }, properties)).toBe(false);
        });
        (0, vitest_1.it)("should evaluate not operator correctly", () => {
            const properties = { name: "test", age: 25 };
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                not: { op: "=", args: [{ property: "name" }, "wrong"] },
            }, properties)).toBe(true);
            (0, vitest_1.expect)((0, cql2_1.evaluateCql2JSONQuery)({
                not: { op: "=", args: [{ property: "name" }, "test"] },
            }, properties)).toBe(false);
        });
    });
    (0, vitest_1.describe)("error handling", () => {
        (0, vitest_1.it)("should throw error for null or undefined query", () => {
            const properties = { name: "test" };
            (0, vitest_1.expect)(() => (0, cql2_1.evaluateCql2JSONQuery)(null, properties)).toThrow("Query cannot be null or undefined");
            (0, vitest_1.expect)(() => (0, cql2_1.evaluateCql2JSONQuery)(undefined, properties)).toThrow("Query cannot be null or undefined");
        });
        (0, vitest_1.it)("should throw error for invalid query format", () => {
            const properties = { name: "test" };
            (0, vitest_1.expect)(() => (0, cql2_1.evaluateCql2JSONQuery)("invalid", properties)).toThrow("Invalid query format: invalid");
        });
        (0, vitest_1.it)("should throw error for unsupported operator", () => {
            const properties = { name: "test" };
            (0, vitest_1.expect)(() => (0, cql2_1.evaluateCql2JSONQuery)({
                op: "unsupported",
                args: [{ property: "name" }, "test"],
            }, properties)).toThrow("Unsupported operator: unsupported");
        });
        (0, vitest_1.it)("should throw error for invalid arguments", () => {
            const properties = { name: "test" };
            (0, vitest_1.expect)(() => (0, cql2_1.evaluateCql2JSONQuery)({
                op: "=",
                args: [{ property: "name" }],
            }, properties)).toThrow("Invalid arguments for operator =");
        });
    });
});
(0, vitest_1.describe)("consolidateCql2Queries", () => {
    (0, vitest_1.it)("should return undefined when both queries are undefined", () => {
        (0, vitest_1.expect)((0, cql2_1.consolidateCql2Queries)(undefined, undefined)).toBeUndefined();
    });
    (0, vitest_1.it)("should return first query when second is undefined", () => {
        const query = { op: "=", args: [{ property: "name" }, "test"] };
        (0, vitest_1.expect)((0, cql2_1.consolidateCql2Queries)(query, undefined)).toBe(query);
    });
    (0, vitest_1.it)("should return second query when first is undefined", () => {
        const query = { op: "=", args: [{ property: "name" }, "test"] };
        (0, vitest_1.expect)((0, cql2_1.consolidateCql2Queries)(undefined, query)).toBe(query);
    });
    (0, vitest_1.it)("should combine two simple queries with OR operator", () => {
        const query1 = { op: "=", args: [{ property: "name" }, "test"] };
        const query2 = { op: "=", args: [{ property: "age" }, 25] };
        const result = (0, cql2_1.consolidateCql2Queries)(query1, query2);
        (0, vitest_1.expect)(result).toEqual({
            op: "or",
            args: [query1, query2],
        });
    });
    (0, vitest_1.it)("should combine complex queries with OR operator", () => {
        const query1 = {
            op: "and",
            args: [
                { op: "=", args: [{ property: "name" }, "test"] },
                { op: "=", args: [{ property: "role" }, "admin"] },
            ],
        };
        const query2 = {
            op: "=",
            args: [{ property: "age" }, 25],
        };
        const result = (0, cql2_1.consolidateCql2Queries)(query1, query2);
        (0, vitest_1.expect)(result).toEqual({
            op: "or",
            args: [query1, query2],
        });
    });
    (0, vitest_1.it)("should preserve query structure when combining", () => {
        const query1 = {
            and: [
                { op: "=", args: [{ property: "name" }, "test"] },
                { op: "=", args: [{ property: "role" }, "admin"] },
            ],
        };
        const query2 = {
            op: "=",
            args: [{ property: "age" }, 25],
        };
        const result = (0, cql2_1.consolidateCql2Queries)(query1, query2);
        (0, vitest_1.expect)(result).toEqual({
            op: "or",
            args: [query1, query2],
        });
    });
});
