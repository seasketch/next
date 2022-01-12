import TextInput, { TextInputOptions } from "../components/TextInput";
import EditorLanguageSelector from "./EditorLanguageSelector";

export default function LocalizableTextInput(props: TextInputOptions) {
  return (
    <>
      <div className="relative">
        <EditorLanguageSelector className="py-0.5 pr-8 pl-0.5 right-0 -top-0.5 absolute" />
        <TextInput {...props} />
      </div>
    </>
  );
}
