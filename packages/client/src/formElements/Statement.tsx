import { Trans, useTranslation } from "react-i18next";
import { FormElementBody, FormElementComponent } from "./FormElement";
import fromMarkdown from "./fromMarkdown";

/**
 * Displays a rich text section
 */
const Statement: FormElementComponent<{}> = (props) => {
  const { t } = useTranslation("admin:surveys");
  return (
    <div className="mb-5">
      <FormElementBody
        formElementId={props.id}
        isInput={false}
        body={props.body}
        editable={props.editable}
      />
    </div>
  );
};

Statement.label = <Trans ns="admin:surveys">Statement</Trans>;
Statement.description = <Trans ns="admin:surveys">Rich text block.</Trans>;
// eslint-disable-next-line i18next/no-literal-string
Statement.defaultBody = fromMarkdown(`
# Heading

Use this page to explain **something**, provide [links](https://seasketch.org), or list items.

  * Option A
  * Option B
  * And C...

`);

export default Statement;
