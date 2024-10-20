import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import plurals from "./lang/plurals.json";

i18n
  .use(LanguageDetector)
  .use({
    type: "backend",
    read(
      language: string,
      namespace: string,
      callback: (errorValue: unknown, translations: null | any) => void
    ) {
      const isDefault =
        language.toLowerCase() === "en" || /en-/i.test(language);
      import(
        /* webpackChunkName: "lang" */ `./lang/${
          isDefault ? "en" : language
        }/${namespace}.json`
      )
        .then((resources) => {
          if (isDefault) {
            callback(null, {
              ...resources,
              ...plurals,
            });
          } else {
            callback(null, resources);
          }
        })
        .catch((error) => {
          callback(error, null);
        });
    },
  })
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    fallbackLng: "en",
    cleanCode: true,
    keySeparator: false,
    nsSeparator: ":",
    interpolation: {
      escapeValue: false,
    },
    react: {
      // Using suspense for language content leads to a lot of flashing and
      // re-rendering in unexpected places. It can even lead to weird issues
      // like poorly placed popups as positioning is determined in a suspended
      // state. Just avoiding for now.
      useSuspense: false,
    },
  });
export default i18n;
