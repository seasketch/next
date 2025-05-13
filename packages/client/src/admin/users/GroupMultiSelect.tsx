import React from "react";
import InputBlock from "../../components/InputBlock";
import Select from "react-select";

interface Group {
  value: number;
  label: string;
}

interface BaseProps {
  groups: Group[];
  description?: string;
  title: string;
  loading?: boolean;
  filterOption?:
    | ((option: any, rawInput: string) => boolean)
    | null
    | undefined;
}

interface MultiSelectProps extends BaseProps {
  value: Group[];
  onChange: (values: Group[]) => void;
}

interface SingleSelectProps extends BaseProps {
  value?: Group;
  onChange: (value?: Group) => void;
}

export default function MultiSelect({
  onChange,
  loading,
  groups,
  value,
  description,
  title,
  filterOption,
}: MultiSelectProps) {
  return (
    <InputBlock
      flexDirection="column"
      children={description ? <p>{description}</p> : undefined}
      input={
        <Select
          filterOption={filterOption}
          isMulti
          menuPortalTarget={document.body}
          menuPosition="absolute"
          menuPlacement="auto"
          onChange={(v, e) => {
            onChange(
              v.map(({ value }) => groups.find((g) => g.value === value)!)
            );
          }}
          styles={styles}
          isLoading={loading}
          value={value}
          className="w-full z-50 mt-2 react-select"
          options={groups}
        />
      }
      title={title}
    />
  );
}

export function SingleSelect({
  onChange,
  loading,
  groups,
  value,
  description,
  title,
  filterOption,
}: SingleSelectProps) {
  return (
    <InputBlock
      flexDirection="column"
      children={description ? <p>{description}</p> : undefined}
      input={
        <Select
          filterOption={filterOption}
          menuPortalTarget={document.body}
          menuPosition="absolute"
          menuPlacement="auto"
          onChange={(v, e) => {
            onChange(groups.find(({ value }) => v?.value === value));
          }}
          styles={styles}
          isLoading={loading}
          value={value}
          className="w-full z-50 mt-2 react-select"
          options={groups}
        />
      }
      title={title}
    />
  );
}

const styles = {
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: "rgba(219, 234, 254, 1)",
    color: "rgba(30, 64, 175, 1)",
    borderRadius: 99,
    paddingLeft: 5,
    paddingRight: 5,
  }),
  multiValueRemove: (base: any) => {
    return {
      ":hover:": { backgroundColor: "transparent" },
    };
  },
};
