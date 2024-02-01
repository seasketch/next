import { i18n } from "i18next";
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import languages, { LangDetails } from "../lang/supported";
import useCurrentLang from "../useCurrentLang";

export default function LanguageSelector(props: {
  options?: string[];
  className?: string;
  button: (onClick: () => void, language: LangDetails) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { i18n, t } = useTranslation("surveys");
  const filteredLanguages = languages.filter(
    (f) =>
      !props.options ||
      props.options.find((o) => o === f.code) ||
      f.code === "EN" ||
      i18n.language?.toLowerCase() === f.code.toLowerCase()
  );
  const options = filteredLanguages;
  const { matchesAnyTranslation, selectedLang } = getSelectedLanguage(
    i18n,
    filteredLanguages
  );

  const selectedLanguage = useCurrentLang();

  if (
    options.length <= 1 &&
    (i18n.language?.toLowerCase() === options[0].code.toLowerCase() ||
      (i18n.language === "en-US" && options[0].code === "EN"))
  ) {
    return null;
  }

  return (
    <>
      {props.button(() => setOpen(true), selectedLang)}

      {open && (
        <Modal
          title={t("Select a language")}
          onRequestClose={() => {
            setOpen(false);
          }}
          className="text-black"
          autoWidth
          zeroPadding
        >
          <div className="md:w-80 pt-2 sm:pt-0">
            {options.map((o) => (
              <Option
                key={o.code}
                language={o}
                selected={selectedLang.code === o.code}
                onClick={(lang) => {
                  i18n.changeLanguage(lang.code);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function Option(props: {
  language: LangDetails;
  selected: boolean;
  onClick: (lang: LangDetails) => void;
}) {
  return (
    <button
      className={`${
        props.selected &&
        "bg-primary-300 hover:bg-opacity-70 hover:bg-primary-300 bg-opacity-50"
      } flex w-full p-4 px-6 hover:bg-gray-100 gap-4`}
      onClick={() => {
        props.onClick(props.language);
      }}
    >
      <span className="flex-1 text-left rtl:text-right">
        {props.language.localName || props.language.name}
      </span>
      <span className="font-mono font-semibold text-gray-500">
        {props.language.code.toUpperCase()}
      </span>
    </button>
  );
}

export function getSelectedLanguage(
  i18n: i18n,
  filteredLanguages?: LangDetails[]
) {
  const match = (filteredLanguages || languages).find(
    (l) => l.code === i18n.language
  );
  const matchesAnyTranslation = Boolean(match);
  const selectedLang = match || languages.find((l) => l.code === "EN")!;
  return {
    matchesAnyTranslation,
    selectedLang,
  };
}
