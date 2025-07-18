import { describe, it, expect } from "vitest";
import { evaluateCql2JSONQuery, consolidateCql2Queries } from "../src/cql2";

describe("evaluateCql2JSONQuery", () => {
  describe("equality operators", () => {
    it("should evaluate = operator correctly", () => {
      const properties = { name: "test", age: 25 };

      // String equality
      expect(
        evaluateCql2JSONQuery(
          {
            op: "=",
            args: [{ property: "name" }, "test"],
          },
          properties
        )
      ).toBe(true);

      // Number equality
      expect(
        evaluateCql2JSONQuery(
          {
            op: "=",
            args: [{ property: "age" }, 25],
          },
          properties
        )
      ).toBe(true);

      // Non-matching values
      expect(
        evaluateCql2JSONQuery(
          {
            op: "=",
            args: [{ property: "name" }, "wrong"],
          },
          properties
        )
      ).toBe(false);
    });

    it("should evaluate != operator correctly", () => {
      const properties = { name: "test", age: 25 };

      // String inequality
      expect(
        evaluateCql2JSONQuery(
          {
            op: "!=",
            args: [{ property: "name" }, "wrong"],
          },
          properties
        )
      ).toBe(true);

      // Number inequality
      expect(
        evaluateCql2JSONQuery(
          {
            op: "!=",
            args: [{ property: "age" }, 30],
          },
          properties
        )
      ).toBe(true);

      // Matching values should return false
      expect(
        evaluateCql2JSONQuery(
          {
            op: "!=",
            args: [{ property: "name" }, "test"],
          },
          properties
        )
      ).toBe(false);
    });
  });

  describe("in operator", () => {
    it("should evaluate in operator correctly", () => {
      const properties = { name: "test", age: 25, tags: ["a", "b"] };

      // String in array
      expect(
        evaluateCql2JSONQuery(
          {
            op: "in",
            args: [{ property: "name" }, ["test", "other"]],
          },
          properties
        )
      ).toBe(true);

      // Number in array
      expect(
        evaluateCql2JSONQuery(
          {
            op: "in",
            args: [{ property: "age" }, [25, 30, 35]],
          },
          properties
        )
      ).toBe(true);

      // Value not in array
      expect(
        evaluateCql2JSONQuery(
          {
            op: "in",
            args: [{ property: "name" }, ["wrong", "other"]],
          },
          properties
        )
      ).toBe(false);

      // Non-array value should return false
      expect(
        evaluateCql2JSONQuery(
          {
            op: "in",
            args: [{ property: "name" }, "test"],
          },
          properties
        )
      ).toBe(false);
    });
  });

  describe("logical operators", () => {
    it("should evaluate and operator correctly", () => {
      const properties = { name: "test", age: 25 };

      expect(
        evaluateCql2JSONQuery(
          {
            and: [
              { op: "=", args: [{ property: "name" }, "test"] },
              { op: "=", args: [{ property: "age" }, 25] },
            ],
          },
          properties
        )
      ).toBe(true);

      expect(
        evaluateCql2JSONQuery(
          {
            and: [
              { op: "=", args: [{ property: "name" }, "test"] },
              { op: "=", args: [{ property: "age" }, 30] },
            ],
          },
          properties
        )
      ).toBe(false);
    });

    it("should evaluate and operator in op/args format", () => {
      const properties = { name: "test", age: 25 };

      expect(
        evaluateCql2JSONQuery(
          {
            op: "and",
            args: [
              { op: "=", args: [{ property: "name" }, "test"] },
              { op: "=", args: [{ property: "age" }, 25] },
            ],
          },
          properties
        )
      ).toBe(true);

      expect(
        evaluateCql2JSONQuery(
          {
            op: "and",
            args: [
              { op: "=", args: [{ property: "name" }, "test"] },
              { op: "=", args: [{ property: "age" }, 30] },
            ],
          },
          properties
        )
      ).toBe(false);
    });

    it("should evaluate or operator correctly", () => {
      const properties = { name: "test", age: 25 };

      expect(
        evaluateCql2JSONQuery(
          {
            or: [
              { op: "=", args: [{ property: "name" }, "wrong"] },
              { op: "=", args: [{ property: "age" }, 25] },
            ],
          },
          properties
        )
      ).toBe(true);

      expect(
        evaluateCql2JSONQuery(
          {
            or: [
              { op: "=", args: [{ property: "name" }, "wrong"] },
              { op: "=", args: [{ property: "age" }, 30] },
            ],
          },
          properties
        )
      ).toBe(false);
    });

    it("should evaluate or operator in op/args format", () => {
      const properties = { name: "test", age: 25 };

      expect(
        evaluateCql2JSONQuery(
          {
            op: "or",
            args: [
              { op: "=", args: [{ property: "name" }, "wrong"] },
              { op: "=", args: [{ property: "age" }, 25] },
            ],
          },
          properties
        )
      ).toBe(true);

      expect(
        evaluateCql2JSONQuery(
          {
            op: "or",
            args: [
              { op: "=", args: [{ property: "name" }, "wrong"] },
              { op: "=", args: [{ property: "age" }, 30] },
            ],
          },
          properties
        )
      ).toBe(false);
    });

    it("should evaluate nested logical operators", () => {
      const properties = { name: "test", age: 25, role: "admin" };

      expect(
        evaluateCql2JSONQuery(
          {
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
          },
          properties
        )
      ).toBe(true);

      expect(
        evaluateCql2JSONQuery(
          {
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
          },
          properties
        )
      ).toBe(false);
    });

    it("should evaluate not operator correctly", () => {
      const properties = { name: "test", age: 25 };

      expect(
        evaluateCql2JSONQuery(
          {
            not: { op: "=", args: [{ property: "name" }, "wrong"] },
          },
          properties
        )
      ).toBe(true);

      expect(
        evaluateCql2JSONQuery(
          {
            not: { op: "=", args: [{ property: "name" }, "test"] },
          },
          properties
        )
      ).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw error for null or undefined query", () => {
      const properties = { name: "test" };
      expect(() => evaluateCql2JSONQuery(null, properties)).toThrow(
        "Query cannot be null or undefined"
      );
      expect(() => evaluateCql2JSONQuery(undefined, properties)).toThrow(
        "Query cannot be null or undefined"
      );
    });

    it("should throw error for invalid query format", () => {
      const properties = { name: "test" };
      expect(() => evaluateCql2JSONQuery("invalid", properties)).toThrow(
        "Invalid query format: invalid"
      );
    });

    it("should throw error for unsupported operator", () => {
      const properties = { name: "test" };
      expect(() =>
        evaluateCql2JSONQuery(
          {
            op: "unsupported",
            args: [{ property: "name" }, "test"],
          },
          properties
        )
      ).toThrow("Unsupported operator: unsupported");
    });

    it("should throw error for invalid arguments", () => {
      const properties = { name: "test" };
      expect(() =>
        evaluateCql2JSONQuery(
          {
            op: "=",
            args: [{ property: "name" }],
          },
          properties
        )
      ).toThrow("Invalid arguments for operator =");
    });
  });
});

describe("consolidateCql2Queries", () => {
  it("should return undefined when both queries are undefined", () => {
    expect(consolidateCql2Queries(undefined, undefined)).toBeUndefined();
  });

  it("should return first query when second is undefined", () => {
    const query = { op: "=", args: [{ property: "name" }, "test"] };
    expect(consolidateCql2Queries(query, undefined)).toBe(query);
  });

  it("should return second query when first is undefined", () => {
    const query = { op: "=", args: [{ property: "name" }, "test"] };
    expect(consolidateCql2Queries(undefined, query)).toBe(query);
  });

  it("should combine two simple queries with OR operator", () => {
    const query1 = { op: "=", args: [{ property: "name" }, "test"] };
    const query2 = { op: "=", args: [{ property: "age" }, 25] };

    const result = consolidateCql2Queries(query1, query2);

    expect(result).toEqual({
      op: "or",
      args: [query1, query2],
    });
  });

  it("should combine complex queries with OR operator", () => {
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

    const result = consolidateCql2Queries(query1, query2);

    expect(result).toEqual({
      op: "or",
      args: [query1, query2],
    });
  });

  it("should preserve query structure when combining", () => {
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

    const result = consolidateCql2Queries(query1, query2);

    expect(result).toEqual({
      op: "or",
      args: [query1, query2],
    });
  });
});
