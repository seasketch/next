import { useTranslation } from "react-i18next";
import { useHistory } from "react-router";
import Button from "../components/Button";
import TextInput from "../components/TextInput";
import {
  FormElementBody,
  FormElementEditorPortal,
  FormElementProps,
} from "./FormElement";

/**
 * Displays rich text at the begining of a survey. Only one WelcomeMessage should be
 * added to form
 */
export default function WelcomeMessage(
  props: FormElementProps<{ beginButtonText: string }>
) {
  const { t } = useTranslation("admin:surveys");
  return (
    <>
      <FormElementBody isInput={false} body={props.body} />
      <Button
        autofocus
        className="mt-6"
        onClick={props.onSubmit}
        label={
          props.componentSettings.beginButtonText?.length
            ? props.componentSettings.beginButtonText
            : ""
        }
        primary
      />
      <FormElementEditorPortal
        render={(updateSettings) => {
          return (
            <TextInput
              name="beginButtonText"
              required
              value={props.componentSettings.beginButtonText}
              onChange={(value) =>
                updateSettings({
                  componentSettings: { beginButtonText: value },
                })
              }
              label={t("Begin Button Text")}
            />
          );
        }}
      />
    </>
  );
}
