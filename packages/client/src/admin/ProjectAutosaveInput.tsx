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
}) {
  const [value, setValue] = useState(props.value);
  const debouncedValue = useDebounce(value, 500);
  const [mutation, mutationStatus] = useMutation(
    props.mutation || UpdateProjectSettingsDocument
  );
  // const [mutation, mutationStatus] = useUpdateProjectSettingsMutation();
  const [changeSinceError, setChangeSinceError] = useState<boolean>(false);

  useEffect(() => {
    if (
      !mutationStatus.loading &&
      ((!mutationStatus.error && props.value !== debouncedValue) ||
        (mutationStatus.error && changeSinceError))
    ) {
      setChangeSinceError(false);
      const variables: any = { slug: props.slug, ...props.additionalVariables };
      variables[props.propName] =
        debouncedValue.length === 0 ? null : debouncedValue;
      mutation({
        variables,
      }).catch((e) => { });
    }
  }, [
    debouncedValue,
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
      label={props.label}
      value={value}
      description={props.description}
      onChange={setValue}
      error={mutationStatus.error?.message}
      autocomplete="off"
      state={
        mutationStatus.called
          ? mutationStatus.loading
            ? "SAVING"
            : "SAVED"
          : "NONE"
      }
    />
  );
}
