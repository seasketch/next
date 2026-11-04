import TextInput, { TextInputOptions } from "../components/TextInput";
import EditorLanguageSelector from "./EditorLanguageSelector";

export default function SurveyLocalizableTextInput(props: TextInputOptions) {
  return (
    <TextInput
      {...props}
      labelAdornment={<EditorLanguageSelector className="shrink-0" />}
    />
  );
}
