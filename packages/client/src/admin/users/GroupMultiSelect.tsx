import React from "react";
import InputBlock from "../../components/InputBlock";
import Select from "react-select";

interface Group {
  value: number;
  label: string;
}

interface Props {
  groups: Group[];
  value: Group[];
  description?: string;
  title: string;
  loading?: boolean;
  onChange: (values: Group[]) => void;
}

export default function MultiSelect({
  onChange,
  loading,
  groups,
  value,
  description,
  title,
}: Props) {
  return (
    <InputBlock
      flexDirection="column"
      children={description ? <p>{description}</p> : undefined}
      input={
        <Select
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
