import { useState } from "react";
import { useTranslation } from "react-i18next";
import TextInput from "../../components/TextInput";
import { useCreateGroupMutation } from "../../generated/graphql";
import { gql } from "@apollo/client";
import Modal from "../../components/Modal";

export default function CreateGroupModal({
  projectId,
  onRequestClose,
}: {
  projectId: number;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const [mutate, mutationState] = useCreateGroupMutation();
  const [name, setName] = useState("");
  let error: string | undefined = mutationState.error?.message;
  if (/namechk/.test(error || "")) {
    error = t("Name is required and must be less than 33 characters");
  }
  const onSubmit = () => {
    mutate({
      variables: {
        projectId,
        name,
      },
      update: (cache, { data }) => {
        if (data?.createGroup?.group) {
          const newGroupData = data.createGroup.group;
          cache.modify({
            id: cache.identify({
              __typename: "Project",
              id: projectId,
            }),
            fields: {
              groups(existingGroupRefs = [], { readField }) {
                const newGroupRef = cache.writeFragment({
                  data: newGroupData,
                  fragment: gql`
                    fragment NewGroup on Group {
                      id
                      projectId
                      name
                    }
                  `,
                });

                return [...existingGroupRefs, newGroupRef];
              },
            },
          });
        }
      },
    })
      .then(onRequestClose)
      .catch((e) => {
        console.error(e);
      });
  };
  return (
    <Modal
      autoWidth
      title={t("Name this new group")}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Create Group"),
          disabled: mutationState.loading,
          onClick: onSubmit,
          variant: "primary",
        },
        {
          label: t("Cancel"),
          onClick: onRequestClose,
        },
      ]}
    >
      <div className="w-80">
        <TextInput
          name="name"
          error={error}
          label={""}
          // required
          value={name}
          onChange={setName}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit();
            }
          }}
        />
      </div>
    </Modal>
  );
}
