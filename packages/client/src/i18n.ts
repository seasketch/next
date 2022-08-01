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
      import(
        /* webpackChunkName: "lang" */ `./lang/${language}/${namespace}.json`
      )
        .then((resources) => {
          if (language === "en") {
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
    // fallbackLng: "en",
    // debug: true,
    keySeparator: false,
    nsSeparator: ":",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true,
    },
  });
export default i18n;
