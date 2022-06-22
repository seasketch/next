import { useEffect, useState } from "react";
import {
  AccessControlListType,
  useAddGroupToAclMutation,
  useGetAclQuery,
  useGroupsQuery,
  useRemoveGroupFromAclMutation,
  useUpdateAclTypeMutation,
} from "../generated/graphql";
import RadioGroup from "./RadioGroup";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import MiniSwitch from "./MiniSwitch";

export default function AccessControlListEditor(props: { nodeId: string }) {
  const { t } = useTranslation(["admin"]);
  const { slug } = useParams<{ slug: string }>();

  const [selectedGroups, setSelectedGroups] = useState<{
    [groupId: number]: boolean;
  }>({});

  const [addGroup, addGroupState] = useAddGroupToAclMutation();
  const [removeGroup, removeGroupState] = useRemoveGroupFromAclMutation();

  const groupsQuery = useGroupsQuery({
    variables: {
      projectSlug: slug,
    },
  });

  const groups = groupsQuery.data?.projectBySlug?.groups;

  const { data } = useGetAclQuery({
    variables: {
      nodeId: props.nodeId,
    },
  });
  const [state, setState] = useState(data?.aclByNodeId?.type);
  const [updateType, updateTypeStatus] = useUpdateAclTypeMutation({
    variables: {
      nodeId: props.nodeId,
      type: state!,
    },
  });

  useEffect(() => {
    if (data) {
      const selectedGroups: any = {};
      for (const groupId of (data.aclByNodeId?.groups || []).map((g) => g.id)) {
        selectedGroups[groupId] = true;
      }
      setSelectedGroups(selectedGroups);
    }
  }, [data]);

  return (
    <RadioGroup
      value={state || data?.aclByNodeId?.type}
      items={[
        {
          label: t("Public"),
          value: AccessControlListType.Public,
          description: t("Accessible to anyone with project access"),
        },
        {
          label: t("Admins Only"),
          value: AccessControlListType.AdminsOnly,
          description: t("Accessible only to project administrators"),
        },
        {
          label: t("By Group"),
          value: AccessControlListType.Group,
          description: t(
            "Access limited to listed user groups, as well as project administrators"
          ),
          children: (
            <ul
              className={`rounded  mt-2 ${
                (state || data?.aclByNodeId?.type) ===
                AccessControlListType.Group
                  ? "block"
                  : "hidden"
              }`}
            >
              {groups?.map((group) => {
                return (
                  <li key={group.id} className="text-gray-800 mb-1 flex">
                    <span className="inline-block flex-1">{group.name}</span>
                    <MiniSwitch
                      className="mr-1 inline-block -mb-1 flex-none"
                      isToggled={selectedGroups[group.id] === true}
                      onClick={() => {
                        const wasActive = !!selectedGroups[group.id];
                        setSelectedGroups((prev) => {
                          return {
                            ...prev,
                            [group.id]: !wasActive,
                          };
                        });
                        if (wasActive) {
                          removeGroup({
                            variables: {
                              groupId: group.id,
                              id: data!.aclByNodeId!.id,
                            },
                          });
                        } else {
                          addGroup({
                            variables: {
                              groupId: group.id,
                              id: data!.aclByNodeId!.id,
                            },
                          });
                        }
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ),
        },
      ]}
      legend={t("Access Control")}
      onChange={(value) => {
        setState(value);
        updateType({
          variables: {
            nodeId: props.nodeId,
            type: value!,
          },
        });
      }}
      error={
        updateTypeStatus.error?.message ||
        addGroupState.error?.message ||
        removeGroupState.error?.message
      }
      state={
        updateTypeStatus.called ||
        addGroupState.called ||
        removeGroupState.called
          ? updateTypeStatus.loading ||
            addGroupState.loading ||
            removeGroupState.loading
            ? "SAVING"
            : "SAVED"
          : "NONE"
      }
    />
  );
}
