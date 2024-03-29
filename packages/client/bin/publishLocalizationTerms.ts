#!/usr/bin/env node
/* eslint-disable i18next/no-literal-string */
import * as request from "request";
import * as fs from "fs";
import * as path from "path";
import * as plurals from "../src/lang/plurals.json";

const util = require("util");

const post = util.promisify(request.post);
(async () => {
  const namespaces: string[] = [];
  fs.readdirSync(path.join(__dirname, `../src/lang/en`)).forEach((file) => {
    if (!/admin/.test(path.basename(file, ".json"))) {
      namespaces.push(path.basename(file, ".json"));
    }
  });
  const res = await post(`https://api.poeditor.com/v2/terms/list`, {
    form: {
      api_token: process.env.POEDITOR_API_TOKEN,
      id: process.env.POEDITOR_PROJECT,
      language: "en",
    },
  });
  const data = JSON.parse(res.body);
  if (data.response.status !== "success") {
    throw new Error(`API response was ${data.response.status}`);
  }
  const terms: {
    term: string;
    context: string;
    plural: string;
    created: string;
    updated: string;
    translation: {
      content: string;
      fuzzy: number;
      updated: string;
    };
    reference: string;
    tags: string[];
    comment: string;
    obsolete?: boolean;
  }[] = data.result.terms;
  console.log(`Publishing namespaces ${namespaces.join(", ")}`);

  const termsToAdd: { term: string; tags: string[]; english: string }[] = [];
  const termsToUpdate: { term: string; tags: string[] }[] = [];
  const pluralsToUpdate: { term: string; translation: { content: string } }[] =
    [];

  for (const namespace of namespaces) {
    const data = JSON.parse(
      fs
        .readFileSync(path.join(__dirname, `../src/lang/en/${namespace}.json`))
        .toString()
    ) as {
      [key: string]: string;
    };
    for (const key in data) {
      const existing = terms.find((t) => t.term === key);
      if (existing) {
        existing.obsolete = false;
        const content = existing.translation.content;
        const plural = plurals[key];
        if (plural) {
          if (existing.translation.content !== plural) {
            pluralsToUpdate.push({
              term: key,
              translation: {
                content: plural,
              },
            });
          }
        }
        if (
          existing.tags.indexOf(namespace.toLowerCase().replace(":", "_")) ===
          -1
        ) {
          existing.tags.push(namespace);
          termsToUpdate.push(existing);
        }
      } else {
        termsToAdd.push({
          term: key,
          english: plurals[key] || data[key],
          tags: [namespace],
        });
      }
    }
  }

  for (const term of terms) {
    if (term.obsolete !== false) {
      term.tags.push("obsolete");
      termsToUpdate.push(term);
    } else if (
      term.obsolete === false &&
      term.tags.indexOf("obsolete") !== -1
    ) {
      term.tags = term.tags.filter((t) => t !== "obsolete");
      termsToUpdate.push(term);
    }
  }

  // update existing terms
  if (termsToUpdate.length > 0) {
    const updated = await post(`https://api.poeditor.com/v2/terms/update`, {
      form: {
        api_token: process.env.POEDITOR_API_TOKEN,
        id: process.env.POEDITOR_PROJECT,
        data: JSON.stringify(termsToUpdate),
      },
    });
    const data = JSON.parse(updated.body);
    if (data.response.status !== "success") {
      throw new Error(`API response was ${data.response.status}`);
    } else {
      console.log(`updated ${data.result.terms.updated} terms`);
    }
  }

  // add missing terms
  if (
    termsToAdd.length &&
    (termsToAdd.length > 1 || termsToAdd[0].term !== "")
  ) {
    console.log(termsToAdd);
    const { statusCode, body } = await post(
      `https://api.poeditor.com/v2/terms/add`,
      {
        form: {
          api_token: process.env.POEDITOR_API_TOKEN,
          id: process.env.POEDITOR_PROJECT,
          data: JSON.stringify(termsToAdd),
        },
      }
    );
    let data = JSON.parse(body);
    if (data.response.status !== "success") {
      console.log(data.response);
      throw new Error(
        `API response was ${data.response.status}. ${data.response.message}`
      );
    } else {
      console.log(`added ${data.result.terms.added} terms`);
    }

    const translations = await post(
      `https://api.poeditor.com/v2/translations/add`,
      {
        form: {
          api_token: process.env.POEDITOR_API_TOKEN,
          id: process.env.POEDITOR_PROJECT,
          language: "en",
          data: JSON.stringify(
            termsToAdd
              .filter((t) => t.english?.length)
              .map((t) => ({
                term: t.term,
                translation: {
                  content: t.english,
                },
              }))
          ),
        },
      }
    );
    data = JSON.parse(translations.body);

    if (data.response.status !== "success") {
      throw new Error(`API response was ${data.response.status}`);
    } else {
      console.log(
        `added default en translations for ${data.result.translations.added} terms`
      );
    }
  }

  if (pluralsToUpdate.length) {
    const updated = await post(
      `https://api.poeditor.com/v2/translations/update`,
      {
        form: {
          api_token: process.env.POEDITOR_API_TOKEN,
          id: process.env.POEDITOR_PROJECT,
          data: JSON.stringify(pluralsToUpdate),
          language: "en",
        },
      }
    );
    const data = JSON.parse(updated.body);
    if (data.response.status !== "success") {
      throw new Error(`API response was ${data.response.status}`);
    } else {
      console.log(
        `updated ${data.result.translations.updated} terms from plurals.json`
      );
    }
  }

  if (termsToAdd.length === 0 && termsToUpdate.length === 0) {
    console.log("No new or updated terms.");
  }
})();
