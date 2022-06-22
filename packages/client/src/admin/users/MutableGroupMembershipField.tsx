import { useTranslation } from "react-i18next";
import { useSetUserGroupsMutation } from "../../generated/graphql";
import GroupMultiSelect from "./GroupMultiSelect";

interface MutableGroupMembershipFieldProps {
  userId: number;
  projectId: number;
  allGroups: { id: number; name: string }[];
  userGroups: { id: number; name: string }[];
}

export default function MutableGroupMembershipField({
  userId,
  projectId,
  allGroups,
  userGroups,
}: MutableGroupMembershipFieldProps) {
  const { t } = useTranslation();
  const [setUserGroups, setUserGroupsMutationState] = useSetUserGroupsMutation({
    refetchQueries: ["UserAdminCounts", "GroupMembers"],
    update: (cache, result) => {
      const user = cache.identify({ __typename: "User", id: userId });
      cache.modify({
        id: user,
        fields: {
          groups(_, { readField }) {
            return allGroups.filter(
              (g) =>
                (result?.data?.setUserGroups?.groupIds || []).indexOf(g.id) !==
                -1
            );
          },
        },
      });
    },
  });

  return (
    <GroupMultiSelect
      title={t("User Groups")}
      description={t(
        "Groups can be used to organize users and control access to resources like data layers and discussion forums."
      )}
      loading={setUserGroupsMutationState.loading}
      value={(userGroups || []).map((g) => ({
        value: g.id,
        label: g.name!,
      }))}
      groups={(allGroups || []).map((g) => ({
        value: g.id,
        label: g.name!,
      }))}
      onChange={(v) => {
        const groupIds = v.map((item) => item.value);
        setUserGroups({
          variables: {
            groupIds,
            projectId,
            userId,
          },
          optimisticResponse: {
            setUserGroups: {
              groupIds,
            },
          },
        });
      }}
    />
  );
}
