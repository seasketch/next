import {
  projectTransaction,
  createSession,
  createGroup,
  addUserToGroup,
  clearSession,
  verifyCRUDOpsLimitedToAdmins,
} from "./helpers";
import { createPool } from "./pool";
import { sql } from "slonik";

const pool = createPool("test");

describe("merge_translated_props", () => {
  test("returns object compatible with translated_props specification", async () => {
    const translatedProps = await pool.oneFirst(
      sql`select merge_translated_props(${sql.json({})}, ${"foo"}, ${sql.json({
        en: "bar",
        kor: "baz",
        div: "qux",
      })})`
    );
    expect(translatedProps).toEqual({
      en: {
        foo: "bar",
      },
      kor: {
        foo: "baz",
      },
      div: {
        foo: "qux",
      },
    });
  });

  test("merges new translations with existing translations", async () => {
    const translatedProps = await pool.oneFirst(
      sql`select merge_translated_props(${sql.json({
        en: {
          foo: "bar",
        },
        kor: {
          foo: "baz",
        },
      })}, ${"foo"}, ${sql.json({
        en: "bar2",
        div: "qux",
      })})`
    );
    expect(translatedProps).toEqual({
      en: {
        foo: "bar2",
      },
      kor: {
        foo: "baz",
      },
      div: {
        foo: "qux",
      },
    });
  });

  test("merges new translations with existing translations for different strings", async () => {
    const translatedProps = await pool.oneFirst(
      sql`select merge_translated_props(${sql.json({
        en: {
          foo: "bar",
        },
        kor: {
          foo: "baz",
        },
      })}, ${"foo2"}, ${sql.json({
        en: "bar2",
        kor: "baz2",
        div: "qux2",
        bal: "bal2",
      })})`
    );
    expect(translatedProps).toEqual({
      en: {
        foo: "bar",
        foo2: "bar2",
      },
      kor: {
        foo: "baz",
        foo2: "baz2",
      },
      div: {
        foo2: "qux2",
      },
      bal: {
        foo2: "bal2",
      },
    });
  });
});
