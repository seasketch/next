import { useState, useEffect, ReactNode } from "react";
import useDebounce from "../useDebounce";
import TextInput from "../components/TextInput";
import { MutationResult } from "@apollo/client";

export default function MutableAutosaveInput(props: {
  propName: string;
  value: string;
  label: string | ReactNode;
  description?: string;
  placeholder?: string;
  mutation: (options: any) => Promise<any>;
  mutationStatus: MutationResult<any>;
  /** variables that should always be assigned when calling mutation */
  variables?: any;
  autofocus?: boolean;
}) {
  const [value, setValue] = useState(props.value);
  const debouncedValue = useDebounce(value, 500);
  const mutation = props.mutation;
  const mutationStatus = props.mutationStatus;
  const [changeSinceError, setChangeSinceError] = useState<boolean>(false);

  useEffect(() => {
    if (
      !mutationStatus.loading &&
      ((!mutationStatus.error && props.value !== debouncedValue) ||
        (mutationStatus.error && changeSinceError))
    ) {
      setChangeSinceError(false);
      const variables: any = { ...props.variables };
      variables[props.propName] = debouncedValue;
      mutation({
        variables,
      }).catch((e) => {});
    }
  }, [
    debouncedValue,
    props.propName,
    props.value,
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
      autoFocus={props.autofocus}
      description={props.description}
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
      placeholder={props.placeholder}
    />
  );
}
