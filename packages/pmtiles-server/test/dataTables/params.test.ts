import { describe, expect, it } from "vitest";
import {
  canonicalQueryString,
  parseInList,
  parseQueryParams,
  QueryError,
} from "../../src/dataTables/params";

function parse(qs: string) {
  return parseQueryParams(new URLSearchParams(qs));
}

describe("parseInList", () => {
  it("parses simple lists", () => {
    expect(parseInList("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims unquoted items", () => {
    expect(parseInList("a , b")).toEqual(["a", "b"]);
  });

  it("supports quoted items containing commas", () => {
    expect(parseInList('"Smith, John",UCSB')).toEqual(["Smith, John", "UCSB"]);
  });

  it("supports escaped quotes", () => {
    expect(parseInList('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
  });
});

describe("parseQueryParams", () => {
  it("parses bare values as equality filters", () => {
    const q = parse("q.year=2018&q.classcode=PYCHEL");
    expect(q.filters).toEqual([
      { column: "year", op: "eq", value: "2018" },
      { column: "classcode", op: "eq", value: "PYCHEL" },
    ]);
  });

  it("parses comparison operators", () => {
    const q = parse("q.count=gte.5&q.depth=lt.10.5");
    expect(q.filters).toEqual([
      { column: "count", op: "gte", value: "5" },
      { column: "depth", op: "lt", value: "10.5" },
    ]);
  });

  it("parses in lists", () => {
    const q = parse("q.observer=in.(Chad Burt,Lyal Belquist)");
    expect(q.filters).toEqual([
      { column: "observer", op: "in", values: ["Chad Burt", "Lyal Belquist"] },
    ]);
  });

  it("parses null tests", () => {
    const q = parse("q.size=is.null&q.depth=not.null");
    expect(q.filters).toEqual([
      { column: "size", op: "isNull" },
      { column: "depth", op: "notNull" },
    ]);
  });

  it("ANDs repeated filters on the same column", () => {
    const q = parse("q.year=gte.2010&q.year=lte.2018");
    expect(q.filters).toHaveLength(2);
  });

  it("parses groupBy, op and column", () => {
    const q = parse("groupBy=site,zone&op=mean,count&column=count");
    expect(q.groupBy).toEqual(["site", "zone"]);
    expect(q.ops).toEqual(["mean", "count"]);
    expect(q.column).toBe("count");
  });

  it("requires column for non-count aggregations", () => {
    expect(() => parse("groupBy=site&op=mean")).toThrow(QueryError);
  });

  it("allows op=count without a column", () => {
    const q = parse("groupBy=site&op=count");
    expect(q.column).toBeNull();
  });

  it("requires op when groupBy is present", () => {
    expect(() => parse("groupBy=site")).toThrow(QueryError);
  });

  it("rejects unknown aggregations", () => {
    expect(() => parse("op=stddev&column=count")).toThrow(QueryError);
  });

  it("defaults to no limit and accepts explicit limits", () => {
    expect(parse("groupBy=site&op=count").limit).toBeNull();
    expect(parse("limit=500").limit).toBe(500);
    expect(parse("limit=100000").limit).toBe(100000);
  });

  it("rejects invalid formats, limits and offsets", () => {
    expect(() => parse("f=xml")).toThrow(QueryError);
    expect(() => parse("limit=0")).toThrow(QueryError);
    expect(() => parse("limit=abc")).toThrow(QueryError);
    expect(() => parse("offset=-1")).toThrow(QueryError);
  });

  it("parses orderBy with direction", () => {
    expect(parse("orderBy=mean:desc").orderBy).toEqual({
      key: "mean",
      direction: "desc",
    });
    expect(parse("orderBy=site").orderBy).toEqual({
      key: "site",
      direction: "asc",
    });
    expect(() => parse("orderBy=site:sideways")).toThrow(QueryError);
  });
});

describe("canonicalQueryString", () => {
  it("orders parameters deterministically and drops f", () => {
    const a = canonicalQueryString(
      new URLSearchParams("f=json&q.b=2&q.a=1&groupBy=site&op=mean&column=c")
    );
    const b = canonicalQueryString(
      new URLSearchParams("op=mean&q.a=1&column=c&groupBy=site&q.b=2&f=html")
    );
    expect(a).toBe(b);
    expect(a).not.toContain("f=");
  });
});
