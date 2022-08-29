import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  MailIcon,
  ExclamationIcon,
  IdentificationIcon,
  PaperClipIcon,
} from "@heroicons/react/outline";
import { UserGroupIcon } from "@heroicons/react/solid";
import Button from "../../components/Button";
import NavSidebar, { NavSidebarItem } from "../../components/NavSidebar";
import {
  Maybe,
  ProjectAccessControlSetting,
  InviteDetailsFragment,
  Group,
  UserListDetailsFragment,
  useCreateGroupMutation,
} from "../../generated/graphql";
import UserSettingsSidebarSkeleton from "./UserSettingsSidebarSkeleton";
import CreateGroupModal from "./CreateGroupModal";
import InviteUsersModal from "./InviteUsersModal";
import { sentStatus, unsentStatus, problemStatus } from "./UserSettings";
import useDialog from "../../components/useDialog";
import { gql } from "@apollo/client";

export default function UserSettingsSidebar({
  invites,
  groups,
  users,
  loading,
  accessControl,
  projectId,
  accessRequests,
}: {
  invites: InviteDetailsFragment[];
  groups: Pick<Group, "name" | "id">[];
  users: UserListDetailsFragment[];
  accessRequests: UserListDetailsFragment[];
  loading: boolean;
  accessControl?: ProjectAccessControlSetting;
  projectId?: number;
}) {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation(["admin"]);
  const [inviteUsersOpen, setInviteUsersOpen] = useState(false);
  const [mutate, mutationState] = useCreateGroupMutation();
  const { prompt } = useDialog();
  const promptToCreateGroup = useCallback(() => {
    prompt({
      message: "Name this new group",
      onSubmit: async (name) => {
        if (!projectId) {
          throw new Error("Unknown project id");
        }
        try {
          await mutate({
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
          });
        } catch (e) {
          if (/namechk/.test(e.toString() || "")) {
            throw new Error(
              t(
                "Name is required and must be less than 33 characters"
              ).toString()
            );
          } else {
            throw e;
          }
        }
      },
    });
  }, [mutate, projectId, prompt, t]);

  const counts = useMemo(() => {
    let results = {
      sent: 0,
      pending: 0,
      problems: 0,
      admins: 0,
      accessRequests: 0,
      groups: {} as { [groupId: number]: number },
    };
    for (const invite of invites) {
      if (problemStatus.indexOf(invite.status!) !== -1) {
        results.problems += 1;
      } else if (sentStatus.indexOf(invite.status!) !== -1) {
        results.sent += 1;
      } else if (unsentStatus.indexOf(invite.status!) !== -1) {
        results.pending += 1;
      }
    }
    for (const group of groups) {
      results.groups[group.id] = 0;
    }
    for (const user of users) {
      if (user.isAdmin) {
        results.admins += 1;
      }
      for (const group of user.groups || []) {
        results.groups[group.id] += 1;
      }
    }
    results.accessRequests = accessRequests.length;
    return results;
  }, [invites, groups, users, accessRequests]);

  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  // eslint-disable-next-line i18next/no-literal-string
  const baseUrl = `/${slug}/admin/users`;

  const badge = (
    count: Maybe<number> | undefined,
    activeBadgeVariant: "primary" | "secondary" | "warning" | "error"
  ) => {
    if (count === undefined || count === null) {
      return {};
    } else {
      return {
        badge: count.toString(),
        badgeVariant: count > 0 ? activeBadgeVariant : "secondary",
      };
    }
  };

  let navItems: NavSidebarItem[] = useMemo(() => {
    return [
      {
        label: t("Participants"),
        description: t(
          "Users will appear in the list if they have shared their profile"
        ),
        href: `${baseUrl}/participants`,
        icon: UserGroupIcon,
        ...badge(users.length, "primary"),
      },
      {
        label: t("Admins"),
        description: t("Admins have full access to project settings"),
        href: `${baseUrl}/admins`,
        icon: () => (
          <svg
            className="w-7 h-6"
            viewBox="0 0 24 24"
            role="img"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="24" height="24" fill="none"></rect>
            <g fillRule="evenodd">
              <circle cx="17" cy="15.5" r="1.12"></circle>
              <path d="M17 17.5c-.73 0-2.19.36-2.24 1.08.5.71 1.32 1.17 2.24 1.17s1.74-.46 2.24-1.17c-.05-.72-1.51-1.08-2.24-1.08z"></path>
              <path d="M18 11.09V6.27L10.5 3 3 6.27v4.91c0 4.54 3.2 8.79 7.5 9.82.55-.13 1.08-.32 1.6-.55A5.973 5.973 0 0017 23c3.31 0 6-2.69 6-6 0-2.97-2.16-5.43-5-5.91zM11 17c0 .56.08 1.11.23 1.62-.24.11-.48.22-.73.3-3.17-1-5.5-4.24-5.5-7.74v-3.6l5.5-2.4 5.5 2.4v3.51c-2.84.48-5 2.94-5 5.91zm6 4c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"></path>
            </g>
          </svg>
        ),
        ...badge(counts.admins, "primary"),
      },
      {
        isGroup: true,
        label: t("Invites"),
        button: (
          <Button
            small
            label={t("Invite Users")}
            onClick={() => setInviteUsersOpen(true)}
          />
        ),
      },
      {
        label: t("Draft Invitations"),
        description: t("Unsent invites that need to be mailed"),
        href: `${baseUrl}/invites/pending`,
        icon: PaperClipIcon,
        ...badge(counts.pending, "warning"),
      },
      {
        label: t("Sent Invitations"),
        description: t(
          "Monitor the status of invites that have been emailed to users"
        ),
        href: `${baseUrl}/invites/sent`,
        icon: MailIcon,
        ...badge(counts.sent, "primary"),
      },
      {
        label: t("Bounces, Complaints, and Errors"),
        description: t(
          "Invites can fail due to incorrect addresses, or problems with a destination server, or being marked as spam"
        ),
        href: `${baseUrl}/invites/problems`,
        icon: ExclamationIcon,
        ...badge(counts.problems, "error"),
      },
      ...(accessControl === ProjectAccessControlSetting.InviteOnly
        ? [
            {
              label: t("Access Requests"),
              description: t(
                "Your project is set to invite-only. Requests to participate can be approved or denied."
              ),
              href: `${baseUrl}/accessRequests`,
              icon: IdentificationIcon,
              ...badge(
                // data?.projectBySlug?.unapprovedParticipantCount,
                counts.accessRequests,
                "primary"
              ),
            },
          ]
        : []),
      {
        isGroup: true,
        label: t("User Groups"),
        button: (
          <Button
            small
            label={t("Create Group")}
            onClick={promptToCreateGroup}
            // onClick={() => setCreateGroupModalOpen(true)}
          />
        ),
      },
      ...(groups || []).map((g) => ({
        label: g.name!,
        // eslint-disable-next-line i18next/no-literal-string
        href: `${baseUrl}/groups/${g.id}`,
        ...badge(counts.groups[g.id] || 0, "primary"),
      })),
    ];
  }, [
    users.length,
    counts.admins,
    counts.groups,
    counts.pending,
    counts.problems,
    counts.accessRequests,
    counts.sent,
    accessControl,
    baseUrl,
    groups,
    t,
  ]);

  // if (error) {
  //   return <div className="p-8">{error.message}</div>;
  // }
  if (loading) {
    return <UserSettingsSidebarSkeleton />;
  }

  return (
    <>
      <div className="bg-white h-full max-h-full overflow-y-auto hidden lg:block shadow z-10">
        <NavSidebar
          animate={true}
          items={navItems}
          header={t("Users and Groups")}
          footer={
            (groups.length || 0) === 0 ? (
              <div className="text-center p-6 text-gray-500 w-full border-8 border-cool-gray-200 mt-2 border-dashed rounded-lg">
                <Trans ns="admin">
                  User groups can be used to grant permission to access certain
                  layers, forums, or sketching tools.
                </Trans>
              </div>
            ) : undefined
          }
        />
        {createGroupModalOpen && projectId && (
          <CreateGroupModal
            projectId={projectId}
            onRequestClose={() => setCreateGroupModalOpen(false)}
          />
        )}
        {inviteUsersOpen && projectId && (
          <InviteUsersModal
            slug={slug}
            projectId={projectId}
            onRequestClose={() => setInviteUsersOpen(false)}
          />
        )}
      </div>
    </>
  );
}
