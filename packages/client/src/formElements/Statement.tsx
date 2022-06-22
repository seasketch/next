import { Trans } from "react-i18next";
import { FormElementBody, FormElementComponent } from "./FormElement";
import fromMarkdown from "./fromMarkdown";

/**
 * Displays a rich text section
 */
const Statement: FormElementComponent<{}> = (props) => {
  return (
    <div className="mb-5">
      <FormElementBody
        formElementId={props.id}
        isInput={false}
        body={props.body}
        editable={props.editable}
        alternateLanguageSettings={props.alternateLanguageSettings}
      />
    </div>
  );
};

Statement.label = <Trans ns="admin:surveys">Statement</Trans>;
Statement.description = <Trans ns="admin:surveys">Rich text block</Trans>;
// eslint-disable-next-line i18next/no-literal-string
Statement.defaultBody = fromMarkdown(`
# Heading

Use this page to explain **something**, provide [links](https://seasketch.org), or list items.

  * Option A
  * Option B
  * And C...

`);

Statement.icon = () => (
  <div className="bg-gray-800 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    {/*eslint-disable-next-line i18next/no-literal-string*/}
    <span className="text-4xl font-serif -mb-4 -ml-1">”</span>
  </div>
);

export default Statement;
