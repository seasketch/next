import React, { useState } from "react";
import Modal from "../../components/Modal";
import { useTranslation, Trans } from "react-i18next";
import TextInput from "../../components/TextInput";
import Button from "../../components/Button";
import { useCreateGroupMutation } from "../../generated/graphql";
import { gql } from "@apollo/client";

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
      open={true}
      title={t("Create a User Group")}
      footer={
        <div>
          <Button
            disabled={mutationState.loading}
            label={t("Cancel")}
            onClick={onRequestClose}
          />
          <Button
            disabled={mutationState.loading}
            className="ml-2"
            primary
            label={t("Submit")}
            onClick={onSubmit}
          />
        </div>
      }
    >
      {/* <div className="w-96"> */}
      <TextInput
        name="name"
        error={error}
        label={t("Group Name")}
        required
        value={name}
        onChange={setName}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit();
          }
        }}
      />
      {/* </div> */}
    </Modal>
  );
}
