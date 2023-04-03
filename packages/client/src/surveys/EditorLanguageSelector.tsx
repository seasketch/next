import { useContext } from "react";
import {
  FormLanguageContext,
  SurveyContext,
} from "../formElements/FormElement";
import languages from "../lang/supported";

export default function EditorLanguageSelector({
  className,
}: {
  className?: string;
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
    <select
      onChange={(e) => setLanguage(e.target.value)}
      value={lang.code || "EN"}
      className={`${className} bg-yellow-300 rounded text-xs `}
    >
      {supportedLanguages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  ) : null;
}
