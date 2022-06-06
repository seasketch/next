import React from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import InputBlock from "../../components/InputBlock";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import Switch from "../../components/Switch";
import {
  useToggleAdminAccessMutation,
  useUserInfoQuery,
  useToggleForumPostingBanMutation,
} from "../../generated/graphql";
import MutableGroupMembershipField from "./MutableGroupMembershipField";
import ProfilePhoto from "./ProfilePhoto";
import UserProfile from "./UserProfile";

/**
 * ParticipantModal displays details about a project participant. A participant
 * is defined as any user who has shared their profile with the project.
 * This modal includes profile details such as the user's name, nickname,
 * picture and email. It also includes the following controls:
 *   * details on canonicalEmail/identity
 *   * admin access management
 *   * group membership controls
 *   * means to ban/un-ban a user from the discussion forums
 *   * details on project invitations
 *     * whether the user was invited or signed themselves up
 *     * the status of project invite emails
 *   * The modal may be expanded in the future with stats on user
 *     participation in the project, but this would have to be balanced
 *     with user privacy.
 */
export default function ParticipantModal({
  userId,
  projectSlug,
  onRequestClose,
  projectId,
}: {
  userId: number;
  projectSlug: string;
  onRequestClose: () => void;
  projectId: number;
}) {
  const { t } = useTranslation("admin");
  const { data, loading, error } = useUserInfoQuery({
    variables: {
      userId,
      slug: projectSlug,
    },
  });
  const [
    toggleForumPostingBan,
    toggleForumPostingBanState,
  ] = useToggleForumPostingBanMutation({
    variables: {
      userId,
      projectId: projectId,
    },
    update: (cache, result) => {
      const userId = cache.identify(data!.user!);
      cache.modify({
        id: userId,
        fields: {
          bannedFromForums(existingValue, { readField }) {
            return !!result.data?.toggleForumPostingBan?.isBanned;
          },
        },
      });
    },
  });
  const [toggleAdmin, toggleAdminMutationState] = useToggleAdminAccessMutation({
    variables: {
      userId,
      projectId: projectId,
    },
    refetchQueries: ["UserAdminCounts"],
    update: (cache, result) => {
      const userId = cache.identify(data!.user!);
      cache.modify({
        id: userId,
        fields: {
          isAdmin(existingValue, { readField }) {
            return !!result.data?.toggleAdminAccess?.isAdmin;
          },
        },
      });
    },
  });
  const title =
    data?.user?.profile?.fullname ||
    data?.user?.profile?.nickname ||
    data?.user?.profile?.email ||
    data?.user?.canonicalEmail;

  return (
    <Modal
      // title={title || "Loading"}
      open={true}
      loading={loading}
      title={
        <div
          className={`flex ${
            data?.user?.bannedFromForums
              ? "bg-red-50 text-red-900"
              : "bg-cool-gray-100"
          } p-2 items-center`}
        >
          <ProfilePhoto
            canonicalEmail={data?.user?.canonicalEmail!}
            {...data?.user?.profile}
            defaultImg="mm"
          />
          <h2 className={`ml-2 text-xl`}>{title}</h2>
        </div>
      }
      onRequestClose={onRequestClose}
      footer={<Button label={t("Close")} onClick={onRequestClose} />}
    >
      {!data?.user && <Spinner />}

      {data?.user && data?.projectBySlug && (
        <div className="md:max-w-lg">
          <UserProfile
            profile={data.user!.profile!}
            canonicalEmail={data.user.canonicalEmail!}
          />
          <div className="mt-2 mb-2 rounded-md shadow-sm flex border border-gray-300">
            <span className="bg-gray-50 rounded-l-md px-3 inline-flex items-center text-gray-500 sm:text-sm py-1">
              <Trans ns="admin">Canonical Email</Trans>
            </span>
            <span className="border-l pl-2 border-gray-300 flex-grow block min-w-0 py-1 bg-cool-gray-50 bg-opacity-60 rounded-none rounded-r-md sm:text-sm">
              {data.user.canonicalEmail}
            </span>
          </div>
          <p className="mt-1 mb-3 max-w-2xl text-sm text-gray-500">
            <Trans ns="admin">
              Unlike the email in a user's public profile, the{" "}
              <em>canonical email</em> is determined during registration and
              SeaSketch will verify ownership before assigning any permissions.
              Reference this identity before assigning admin or group access.
            </Trans>
          </p>
          <InputBlock
            className=""
            children={
              <p>
                <Trans ns="admin">
                  Administrators will be given full access to change project
                  settings. They can manage data layers, change access control
                  settings, and moderate the discussion forums.
                </Trans>
              </p>
            }
            input={
              <Switch
                isToggled={!!data.user.isAdmin}
                onClick={() =>
                  toggleAdmin({
                    optimisticResponse: {
                      toggleAdminAccess: {
                        isAdmin: !data.user?.isAdmin || false,
                      },
                    },
                  })
                }
              />
            }
            title={t("Administrator Access")}
          />
          {data.projectBySlug?.groups && (
            <MutableGroupMembershipField
              userId={userId}
              projectId={projectId}
              allGroups={data.projectBySlug.groups}
              userGroups={data.user.groups || []}
            />
          )}
          <InputBlock
            className="mt-4"
            children={
              <p>
                <Trans ns="admin">
                  Banned users cannot post to any forums. Existing posts will
                  remain unless hidden.
                </Trans>
              </p>
            }
            input={
              <Switch
                isToggled={!!data.user.bannedFromForums}
                onClick={() =>
                  toggleForumPostingBan({
                    optimisticResponse: {
                      toggleForumPostingBan: {
                        isBanned: !data.user?.bannedFromForums || false,
                      },
                    },
                  })
                }
              />
            }
            title={t("Ban from Forums")}
          />
          {/*  */}
        </div>
      )}
    </Modal>
  );
}
