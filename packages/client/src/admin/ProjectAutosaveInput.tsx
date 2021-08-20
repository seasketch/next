import React, { useState, useEffect } from "react";
import useDebounce from "../useDebounce";
import { useUpdateProjectSettingsMutation } from "../generated/graphql";
import TextInput from "../components/TextInput";

export default function ProjectAutosaveInput(props: {
  propName: string;
  value: string;
  label: string;
  slug: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(props.value);
  const debouncedValue = useDebounce(value, 500);
  const [mutation, mutationStatus] = useUpdateProjectSettingsMutation();
  const [changeSinceError, setChangeSinceError] = useState<boolean>(false);

  useEffect(() => {
    if (
      !mutationStatus.loading &&
      ((!mutationStatus.error && props.value !== debouncedValue) ||
        (mutationStatus.error && changeSinceError))
    ) {
      setChangeSinceError(false);
      const variables: any = { slug: props.slug };
      variables[props.propName] = debouncedValue;
      mutation({
        variables,
      }).catch((e) => {});
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
      name={props.propName}
      label={props.label}
      value={value}
      onChange={setValue}
      error={mutationStatus.error?.message}
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
