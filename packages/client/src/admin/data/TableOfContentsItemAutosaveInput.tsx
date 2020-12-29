import React, { useState, useEffect } from "react";
import useDebounce from "../../useDebounce";
import {
  useUpdateProjectSettingsMutation,
  useUpdateTableOfContentsItemMutation,
} from "../../generated/graphql";
import TextInput from "../../components/TextInput";

export default function TableOfContentsItemAutosaveInput(props: {
  propName: string;
  value: string;
  label: string;
  id: number;
  description?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(props.value);
  const debouncedValue = useDebounce(value, 500);
  const [mutation, mutationStatus] = useUpdateTableOfContentsItemMutation();
  const [changeSinceError, setChangeSinceError] = useState<boolean>(false);

  useEffect(() => {
    if (
      !mutationStatus.loading &&
      ((!mutationStatus.error && props.value !== debouncedValue) ||
        (mutationStatus.error && changeSinceError))
    ) {
      setChangeSinceError(false);
      const variables: any = { id: props.id };
      variables[props.propName] = debouncedValue;
      mutation({
        variables,
      }).catch((e) => {});
    }
  }, [
    debouncedValue,
    props.propName,
    props.value,
    props.id,
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
      description={props.description}
      id={props.propName}
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
