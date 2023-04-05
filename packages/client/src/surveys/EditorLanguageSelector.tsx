import { useContext } from "react";
import {
  FormLanguageContext,
  SurveyContext,
} from "../formElements/FormElement";
import languages from "../lang/supported";
import TranslateIcon from "@heroicons/react/outline/TranslateIcon";

export default function EditorLanguageSelector({
  className,
  large,
}: {
  className?: string;
  large?: boolean;
}) {
  const context = useContext(FormLanguageContext);
  if (!context) {
    return null;
  }
  const { setLanguage, lang } = context;
  const supportedLanguages = languages.filter(
    (l) => context.supportedLanguages.indexOf(l.code) !== -1 || l.code === "EN"
  );
  return supportedLanguages.length > 1 ? (
    <div
      className={`z-10 ${
        !className || !/absolute/.test(className) ? "relative" : ""
      } ${className}`}
    >
      <TranslateIcon
        className={`absolute left-2 ${
          Boolean(large) ? "top-1.5" : "top-1"
        } w-4 h-4 text-black`}
        style={{ marginTop: -0.5 }}
      />
      <select
        onChange={(e) => setLanguage(e.target.value)}
        value={lang.code || "EN"}
        className={` border-gray-300 shadow-sm rounded text-sm pl-8 pr-8 text-black bg-white ${
          large ? "py-0.5" : "py-0"
        }`}
      >
        {supportedLanguages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  ) : null;
}
