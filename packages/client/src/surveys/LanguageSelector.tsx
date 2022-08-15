import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import languages, { LangDetails } from "../lang/supported";

export default function LanguageSelector(props: {
  options?: string[];
  className?: string;
  button: (onClick: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation("surveys");
  const filteredLanguages = languages.filter(
    (f) =>
      !props.options ||
      props.options.find((o) => o === f.code) ||
      f.code === "EN"
  );
  const options = filteredLanguages;
  const matchesAnyTranslation = filteredLanguages.find(
    (l) => l.code === i18n.language
  );
  return (
    <>
      {props.button(() => setOpen(true))}

      {open && (
        <Modal
          // title={t("Select a language")}
          onRequestClose={() => setOpen(false)}
          className="text-black"
          autoWidth
          zeroPadding
        >
          <div className="md:w-80 pt-2 sm:pt-0">
            {options.map((o) => (
              <Option
                key={o.code}
                language={o}
                selected={
                  (o.code === "EN" && !matchesAnyTranslation) ||
                  i18n.language?.toUpperCase() === o.code.toUpperCase()
                }
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
      } flex w-full p-4 hover:bg-gray-100`}
      onClick={() => props.onClick(props.language)}
    >
      <span className="flex-1">
        {props.language.localName || props.language.name}
      </span>
      <span className="">{props.language.code.toUpperCase()}</span>
    </button>
  );
}
