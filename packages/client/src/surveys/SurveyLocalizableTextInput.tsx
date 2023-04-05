import TextInput, { TextInputOptions } from "../components/TextInput";
import EditorLanguageSelector from "./EditorLanguageSelector";

export default function SurveyLocalizableTextInput(props: TextInputOptions) {
  return (
    <>
      <div className="relative">
        <EditorLanguageSelector className="right-0 -top-0.5 absolute" />
        <TextInput {...props} />
      </div>
    </>
  );
}
