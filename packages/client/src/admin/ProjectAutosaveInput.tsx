import { useState, useEffect, ReactNode } from "react";
import useDebounce from "../useDebounce";
import { UpdateProjectSettingsDocument } from "../generated/graphql";
import TextInput from "../components/TextInput";
import { DocumentNode, useMutation } from "@apollo/client";

export default function ProjectAutosaveInput(props: {
  propName: string;
  value: string;
  label: string | ReactNode;
  slug: string;
  placeholder?: string;
  convertEmptyToNull?: boolean;
  description?: string | ReactNode;
  mutation?: DocumentNode;
  additionalVariables?: any;
  type?: "text" | "email";
  /** Return a message to block the save. Called with the normalized value. */
  validate?: (value: string) => string | undefined;
  /** Applied before validation and before the value is sent. */
  normalize?: (value: string) => string;
}) {
  const [value, setValue] = useState(props.value);
  const debouncedValue = useDebounce(value, 500);
  const [mutation, mutationStatus] = useMutation(
    props.mutation || UpdateProjectSettingsDocument
  );
  // const [mutation, mutationStatus] = useUpdateProjectSettingsMutation();
  const [changeSinceError, setChangeSinceError] = useState<boolean>(false);
  const nextValue = props.normalize
    ? props.normalize(debouncedValue)
    : debouncedValue;
  const validationMessage = props.validate?.(nextValue);

  useEffect(() => {
    if (validationMessage) {
      return;
    }
    if (
      !mutationStatus.loading &&
      ((!mutationStatus.error && props.value !== nextValue) ||
        (mutationStatus.error && changeSinceError))
    ) {
      setChangeSinceError(false);
      const variables: any = { slug: props.slug, ...props.additionalVariables };
      variables[props.propName] = nextValue.length === 0 ? null : nextValue;
      mutation({
        variables,
      }).catch((e) => {});
    }
  }, [
    debouncedValue,
    nextValue,
    validationMessage,
    props.propName,
    props.value,
    props.slug,
    mutation,
    mutationStatus,
    changeSinceError,
  ]);

  useEffect(() => {
    if (changeSinceError === false && mutationStatus.error) {
      setChangeSinceError(true);
    }
  }, [debouncedValue]);

  return (
    <TextInput
      placeholder={props.placeholder}
      name={props.propName}
      type={props.type}
      label={props.label}
      value={value}
      description={props.description}
      onChange={setValue}
      error={validationMessage || mutationStatus.error?.message}
      autocomplete="off"
      state={
        validationMessage
          ? "NONE"
          : mutationStatus.called
            ? mutationStatus.loading
              ? "SAVING"
              : "SAVED"
            : "NONE"
      }
    />
  );
}
