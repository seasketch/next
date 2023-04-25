import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import InputBlock from "../../components/InputBlock";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import Switch from "../../components/Switch";
import useDialog from "../../components/useDialog";
import Warning from "../../components/Warning";
import {
  useToggleAdminAccessMutation,
  useUserInfoQuery,
  useToggleForumPostingBanMutation,
  useApproveAccessRequestMutation,
  useDenyAccessRequestMutation,
} from "../../generated/graphql";
import MutableGroupMembershipField from "./MutableGroupMembershipField";
import ProfilePhoto from "./ProfilePhoto";
import UserProfile from "./UserProfile";
import { CheckIcon } from "@heroicons/react/outline";

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
  const { data, loading } = useUserInfoQuery({
    variables: {
      userId,
      slug: projectSlug,
      projectId,
    },
  });
  const onError = useGlobalErrorHandler();
  const [approve, approveState] = useApproveAccessRequestMutation({
    variables: {
      projectId,
      slug: projectSlug,
      userId,
    },
    onError,
  });
  const [deny, denyState] = useDenyAccessRequestMutation({
    variables: {
      projectId,
      slug: projectSlug,
      userId,
    },
    onError,
  });
  const [toggleForumPostingBan] = useToggleForumPostingBanMutation({
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
  const [toggleAdmin] = useToggleAdminAccessMutation({
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

  const { confirm } = useDialog();

  return (
    <Modal
      scrollable
      loading={loading}
      title={
        <div
          className={`flex ${
            data?.user?.bannedFromForums
              ? "bg-red-50 text-red-900"
              : "bg-transparent"
          } items-center`}
        >
          <div className="w-8 h-8 lg:w-12 lg:h-12 lg:mr-1">
            <ProfilePhoto
              canonicalEmail={data?.user?.canonicalEmail!}
              {...data?.user?.profile}
              defaultImg="mm"
            />
          </div>
          <h2 className={`ml-2 text-xl lg:text-2xl`}>{title}</h2>
        </div>
      }
      onRequestClose={onRequestClose}
      footer={[{ label: t("Close"), onClick: onRequestClose }]}
    >
      {!data?.user && <Spinner />}

      {data?.user && data?.projectBySlug && (
        <div className="">
          {data?.user?.needsAccessRequestApproval && !data.user.deniedBy && (
            <div className="mb-4">
              <Warning level="info" className="bg-gray-50">
                <Trans ns="admin">
                  This user access request has yet to be approved.
                </Trans>
                <br />
                <div className="mt-2 space-x-2">
                  <Button
                    disabled={approveState.loading || denyState.loading}
                    loading={approveState.loading}
                    primary
                    small
                    onClick={() => approve()}
                    label={t("Approve")}
                  />
                  <Button
                    disabled={approveState.loading || denyState.loading}
                    loading={denyState.loading}
                    small
                    label={t("Deny")}
                    onClick={() => deny()}
                  />
                </div>
              </Warning>
            </div>
          )}
          {data?.user?.approvedBy && (
            <div className="mb-4">
              <Warning level="info" className="bg-gray-50">
                <Trans ns="admin">
                  This user's access request was approved by
                  <br />
                  {data.user.approvedBy.canonicalEmail} on{" "}
                  {data.user.approvedOrDeniedOn
                    ? new Date(data.user.approvedOrDeniedOn).toLocaleString()
                    : "unknown"}
                </Trans>
                <br />
                <Button
                  className="block mt-2"
                  disabled={approveState.loading || denyState.loading}
                  loading={denyState.loading}
                  small
                  label={t("Block user access")}
                  onClick={async () => {
                    if (
                      await confirm(
                        t(
                          "Are you sure you want to deny this user access to the project?"
                        )
                      )
                    ) {
                      deny();
                    }
                  }}
                />
              </Warning>
            </div>
          )}
          {data?.user?.deniedBy && (
            <div className="mb-4">
              <Warning className="bg-gray-50">
                <Trans ns="admin">
                  This user's access request was denied by
                  <br />
                  {data.user.deniedBy.canonicalEmail} on{" "}
                  {data.user.approvedOrDeniedOn
                    ? new Date(data.user.approvedOrDeniedOn).toLocaleString()
                    : "unknown"}
                </Trans>
                <br />
                <div className="mt-2 space-x-2">
                  <Button
                    disabled={approveState.loading || denyState.loading}
                    loading={approveState.loading}
                    small
                    onClick={() => approve()}
                    label={t("Approve access")}
                  />
                </div>
              </Warning>
            </div>
          )}
          <UserProfile
            profile={data.user!.profile!}
            canonicalEmail={data.user.canonicalEmail!}
          />
          <div className="mt-2 mb-2 rounded-md shadow-sm flex border border-gray-300">
            <span className="bg-gray-50 rounded-l-md px-3 inline-flex items-center text-gray-500 sm:text-sm py-1">
              <Trans ns="admin">Canonical Email</Trans>
            </span>
            <span className="border-l pl-2 border-gray-300 flex-grow block min-w-0 py-1 bg-white bg-opacity-60 rounded-none sm:text-sm flex-1 truncate">
              {data.user.canonicalEmail}
            </span>
            {/* <span className="bg-white rounded-r-md px-3 inline-flex items-center text-gray-500 sm:text-sm py-1">
              {data.user.emailVerified && (
                <span className="text-green-700 flex">
                  <Trans ns="admin">verified</Trans>
                  <CheckIcon className="w-5 h-5 ml-1" />
                </span>
              )}
            </span> */}
          </div>
          <p className="mt-1 mb-3 text-sm text-gray-500">
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
        </div>
      )}
    </Modal>
  );
}
