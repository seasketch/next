import type { RefetchQueriesInclude } from "@apollo/client";
import { useCallback, useMemo } from "react";
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

type SimpleGroup = { id: number; name: string };
type InitialAcl = {
  id: number;
  nodeId: string;
  type: AccessControlListType;
  groups?: SimpleGroup[] | null;
};

export default function AccessControlListEditor(props: {
  nodeId: string;
  legend?: string | null;
  compact?: boolean;
  projectSlug?: string;
  onMutate?: () => void;
  initialAcl?: InitialAcl | null;
  refetchQueries?: RefetchQueriesInclude;
}) {
  const { t } = useTranslation("admin");
  const { slug } = useParams<{ slug: string }>();
  const projectSlug = props.projectSlug || slug;
  const legend =
    props.legend === undefined ? t("Access Control") : props.legend;

  const [addGroup, addGroupState] = useAddGroupToAclMutation();
  const [removeGroup, removeGroupState] = useRemoveGroupFromAclMutation();

  const groupsQuery = useGroupsQuery({
    variables: {
      projectSlug,
    },
    skip: !projectSlug,
  });

  const groups = groupsQuery.data?.projectBySlug?.groups;

  const { data } = useGetAclQuery({
    variables: {
      nodeId: props.nodeId,
    },
  });
  const [updateType, updateTypeStatus] = useUpdateAclTypeMutation();

  const fetchedAcl =
    data?.aclByNodeId?.nodeId === props.nodeId ? data.aclByNodeId : undefined;
  const acl = fetchedAcl || props.initialAcl;
  const activeType = acl?.type || AccessControlListType.Public;
  const selectedGroupIds = useMemo(
    () => new Set((acl?.groups || []).map((group) => group.id)),
    [acl?.groups]
  );
  const currentGroups = useMemo(
    () =>
      (acl?.groups || []).map((group) => ({
        __typename: "Group" as const,
        id: group.id,
        name: group.name,
      })),
    [acl?.groups]
  );
  const groupsById = useMemo(() => {
    const map = new Map<number, SimpleGroup>();
    for (const group of groups || []) {
      map.set(group.id, { id: group.id, name: group.name });
    }
    return map;
  }, [groups]);

  const buildOptimisticAcl = useCallback(
    (
      nextType: AccessControlListType,
      nextGroups: Array<{ __typename: "Group"; id: number; name: string }>
    ) => {
      if (!acl) return undefined;
      return {
        __typename: "Acl" as const,
        id: acl.id,
        nodeId: acl.nodeId,
        type: nextType,
        groups: nextGroups,
      };
    },
    [acl]
  );

  const mutationError =
    updateTypeStatus.error?.message ||
    addGroupState.error?.message ||
    removeGroupState.error?.message;
  const mutationState =
    updateTypeStatus.called || addGroupState.called || removeGroupState.called
      ? updateTypeStatus.loading ||
        addGroupState.loading ||
        removeGroupState.loading
        ? "SAVING"
        : "SAVED"
      : "NONE";

  const handleTypeChange = useCallback(
    (value: AccessControlListType) => {
      if (!acl) return;
      props.onMutate?.();
      updateType({
        variables: {
          nodeId: props.nodeId,
          type: value,
        },
        optimisticResponse: {
          __typename: "Mutation",
          updateAclByNodeId: {
            __typename: "UpdateAclPayload",
            acl: buildOptimisticAcl(value, currentGroups)!,
          },
        },
        ...(props.refetchQueries
          ? { refetchQueries: props.refetchQueries }
          : {}),
      });
    },
    [acl, buildOptimisticAcl, currentGroups, props, updateType]
  );

  const handleGroupToggle = useCallback(
    (groupId: number) => {
      if (!acl) return;
      const wasActive = selectedGroupIds.has(groupId);
      const group = groupsById.get(groupId);
      if (!group) return;
      props.onMutate?.();

      const nextGroups = wasActive
        ? currentGroups.filter((current) => current.id !== groupId)
        : [
            ...currentGroups,
            {
              __typename: "Group" as const,
              id: group.id,
              name: group.name,
            },
          ];

      if (wasActive) {
        removeGroup({
          variables: {
            groupId,
            id: acl.id,
          },
          optimisticResponse: {
            __typename: "Mutation",
            removeGroupFromAcl: {
              __typename: "RemoveGroupFromAclPayload",
              acl: buildOptimisticAcl(activeType, nextGroups)!,
            },
          },
          ...(props.refetchQueries
            ? { refetchQueries: props.refetchQueries }
            : {}),
        });
      } else {
        addGroup({
          variables: {
            groupId,
            id: acl.id,
          },
          optimisticResponse: {
            __typename: "Mutation",
            addGroupToAcl: {
              __typename: "AddGroupToAclPayload",
              acl: buildOptimisticAcl(activeType, nextGroups)!,
            },
          },
          ...(props.refetchQueries
            ? { refetchQueries: props.refetchQueries }
            : {}),
        });
      }
    },
    [
      acl,
      activeType,
      addGroup,
      buildOptimisticAcl,
      currentGroups,
      groupsById,
      removeGroup,
      selectedGroupIds,
      props,
    ]
  );

  if (props.compact) {
    return (
      <div className="w-72">
        {legend ? (
          <div className="mb-2 text-[11px] font-medium text-gray-500">
            {legend}
          </div>
        ) : null}
        {mutationError && (
          <p className="mb-2 text-xs text-red-800">{mutationError}</p>
        )}
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          {[
            {
              label: t("Public"),
              value: AccessControlListType.Public,
            },
            {
              label: t("Admins Only"),
              value: AccessControlListType.AdminsOnly,
            },
            {
              label: t("By Group"),
              value: AccessControlListType.Group,
            },
          ].map((item, index) => {
            const selected = activeType === item.value;
            return (
              <button
                key={item.value}
                type="button"
                className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors ${
                  index > 0 ? "border-t border-gray-100" : ""
                } ${selected ? "bg-gray-50" : "hover:bg-gray-50/70"}`}
                onClick={() => handleTypeChange(item.value)}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                    selected
                      ? "border-primary-500"
                      : "border-gray-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {selected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                  )}
                </span>
                <span className="font-medium text-gray-900">{item.label}</span>
              </button>
            );
          })}
        </div>
        {activeType === AccessControlListType.Group && (
          <div className="mt-2">
            <div className="mb-1 text-[11px] font-medium text-gray-500">
              {t("Groups")}
            </div>
            {groupsQuery.loading ? (
              <div className="rounded-md border border-gray-100 bg-gray-50 px-2 py-2 text-xs text-gray-500">
                {t("Loading groups...")}
              </div>
            ) : groupsQuery.error ? (
              <div className="rounded-md border border-red-100 bg-red-50 px-2 py-2 text-xs text-red-700">
                {groupsQuery.error.message}
              </div>
            ) : groups && groups.length > 0 ? (
              <ul className="max-h-44 space-y-0.5 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <li key={group.id}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-800">
                        {group.name}
                      </span>
                      <MiniSwitch
                        className="mr-0 origin-right scale-90"
                        isToggled={selectedGroupIds.has(group.id)}
                        onClick={() => handleGroupToggle(group.id)}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-md border border-gray-100 bg-gray-50 px-2 py-2 text-xs text-gray-500">
                {t("No groups available for this project.")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <RadioGroup
      value={activeType}
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
                activeType === AccessControlListType.Group
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
                      isToggled={selectedGroupIds.has(group.id)}
                      onClick={() => handleGroupToggle(group.id)}
                    />
                  </li>
                );
              })}
            </ul>
          ),
        },
      ]}
      legend={legend}
      onChange={handleTypeChange}
      error={mutationError}
      state={mutationState}
    />
  );
}
