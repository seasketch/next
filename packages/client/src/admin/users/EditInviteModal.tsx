import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import InputBlock from "../../components/InputBlock";
import Modal from "../../components/Modal";
import Switch from "../../components/Switch";
import TextInput from "../../components/TextInput";
import {
  useInviteEditorModalQueryQuery,
  InviteStatus,
  useUpdateProjectInviteMutation,
  EmailStatus,
  InviteEmail,
  useDeleteProjectInviteMutation,
  useSendInviteMutation,
  ProjectInviteEmailStatusSubscriptionDocument,
} from "../../generated/graphql";
import GroupMultiSelect from "./GroupMultiSelect";
import InviteIcon from "./InviteIcon";
import { TrashIcon } from "@heroicons/react/outline";
import gql from "graphql-tag";
import { useSubscription } from "@apollo/client";

export default function EditInviteModal({
  id,
  slug,
  onRequestClose,
}: {
  id: number;
  slug: string;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const { data, loading, error, refetch } = useInviteEditorModalQueryQuery({
    variables: {
      inviteId: id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });
  useSubscription(ProjectInviteEmailStatusSubscriptionDocument, {
    variables: {
      projectId: data?.currentProject?.id,
    },
    onSubscriptionData: (data) => {
      const invite =
        data.subscriptionData.data.projectInviteStateUpdated.invite;
      if (invite?.id === id) {
        refetch();
      }
    },
  });
  const [state, setState] = useState<{
    fullname: string;
    email: string;
    groups: { id: number; name: string }[];
    makeAdmin: boolean;
    error?: string;
    hasChanged: boolean;
  }>();
  const [expandedEmails, setExpandedEmails] = useState<{
    [id: number]: boolean;
  }>({});

  const updateState = (prop: string) => (val: any) => {
    // @ts-ignore
    setState((prev) => ({ ...prev, [prop]: val, hasChanged: true }));
  };

  const [updateInvite, mutationState] = useUpdateProjectInviteMutation({
    variables: {
      ...state!,
      groups: (state?.groups || []).map((g) => g.id),
      id,
    },
    // refetchQueries: ["UserAdminCounts", "ProjectInvites"],
  });

  const [deleteInvite, deleteInviteState] = useDeleteProjectInviteMutation({
    variables: {
      id,
    },
    update: (cache) => {
      const id = cache.identify(data!.projectInvite!);
      cache.evict({
        id,
      });
      cache.gc();
    },
  });

  const [sendInvite, sendInviteState] = useSendInviteMutation({
    variables: {
      id,
    },
    // refetchQueries: ["UserAdminCounts", "ProjectInvites"],
    onError: (e) => window.alert(e),
    // @ts-ignore
    optimisticResponse: () => {
      const res = {
        sendProjectInvites: {
          inviteEmails: [
            {
              __typename: "InviteEmail",
              id: 99999,
              toAddress: data?.projectInvite?.email,
              createdAt: new Date().toISOString(),
              status: EmailStatus.Queued,
              projectInviteId: data!.projectInvite!.id,
              tokenExpiresAt: null,
              error: null,
              updatedAt: null,
            },
          ],
        },
      };
      return res;
    },
    update: (cache, mutationResult) => {
      if (
        (mutationResult.data?.sendProjectInvites?.inviteEmails?.length || 0) > 0
      ) {
        cache.modify({
          id: cache.identify(data!.projectInvite!),
          fields: {
            inviteEmails(existingEmails = []) {
              const newEmailRef = cache.writeFragment({
                data: mutationResult.data!.sendProjectInvites!.inviteEmails![0],
                fragment: gql`
                  fragment NewInviteEmail on InviteEmail {
                    id
                    toAddress
                    createdAt
                    status
                    tokenExpiresAt
                    error
                    updatedAt
                  }
                `,
              });
              return [...existingEmails, newEmailRef];
            },
            status: () => "QUEUED",
          },
        });
      }
    },
  });

  useEffect(() => {
    if (data?.currentProject && data.projectInvite) {
      setState({
        email: data.projectInvite.email,
        fullname: data.projectInvite.fullname || "",
        makeAdmin: data.projectInvite.makeAdmin,
        groups: data.projectInvite.groups || [],
        hasChanged: false,
      });
    }
  }, [data]);

  const emailStatusText = (
    email: Pick<
      InviteEmail,
      "status" | "createdAt" | "updatedAt" | "toAddress" | "tokenExpiresAt"
    >
  ) => {
    if (tokenExpired(email)) {
      return (
        <Trans ns="admin">
          Invitation token expired{" "}
          {new Date(email.tokenExpiresAt).toLocaleString()}
        </Trans>
      );
    }
    switch (email.status) {
      case EmailStatus.Queued:
        return <Trans ns="admin">Email is being sent</Trans>;
      case EmailStatus.Sent:
        return (
          <Trans ns="admin">
            Email sent {new Date(email.createdAt).toLocaleString()}
          </Trans>
        );
      case EmailStatus.Complaint:
        return <Trans ns="admin">Email was marked as spam by recipient</Trans>;
      case EmailStatus.Bounced:
        return <Trans ns="admin">Email bounced</Trans>;
      case EmailStatus.Delivered:
        return (
          <Trans ns="admin">
            Email delivered {new Date(email.createdAt).toLocaleString()}
          </Trans>
        );
      case EmailStatus.Error:
        return <Trans ns="admin">Email failed with error</Trans>;
      case EmailStatus.Unsubscribed:
        return (
          <Trans ns="admin">
            Recipient unsubscribed from all SeaSketch emails
          </Trans>
        );
      default:
        return t(`Email status is unknown`);
    }
  };

  return (
    <Modal
      disableBackdropClick={state?.hasChanged}
      disableEscapeKeyDown={state?.hasChanged}
      open={true}
      loading={!data && !state}
      title={t("Edit Invite")}
      onRequestClose={onRequestClose}
      footer={
        <>
          <Button
            label={state?.hasChanged ? t("Cancel") : t("Close")}
            onClick={onRequestClose}
            disabled={mutationState.loading || deleteInviteState.loading}
          />
          <Button
            disabled={
              mutationState.loading ||
              !state?.hasChanged ||
              deleteInviteState.loading
            }
            primary
            label={t("Submit Changes")}
            onClick={() => {
              updateInvite()
                .then(() => {
                  onRequestClose();
                })
                .catch((e) => window.alert(e));
            }}
          />
          {data?.projectInvite?.status !== InviteStatus.Confirmed && (
            <Button
              disabled={mutationState.loading || deleteInviteState.loading}
              className="right-4 absolute"
              onClick={() => {
                if (
                  window.confirm(
                    t("Are you sure you want to delete this project invite?")
                  )
                ) {
                  deleteInvite()
                    .then(() => {
                      onRequestClose();
                    })
                    .catch((e) => {
                      alert(e);
                    });
                }
              }}
              label={
                <>
                  <TrashIcon className="w-4 h-4 mr-2 -ml-1" />
                  {t("Delete Invite")}
                </>
              }
            />
          )}
        </>
      }
    >
      {state && data?.projectInvite && data.currentProject && (
        <div className="w-full sm:w-auto">
          <div className="max-w-lg mb-4">
            <TextInput
              autoFocus
              disabled={data.projectInvite.status !== InviteStatus.Unsent}
              id="recipient"
              type="email"
              label={t("Email")}
              description={
                data.projectInvite.status === InviteStatus.Unsent
                  ? t(
                      "The invitation will be sent here. If the recipient would like to register using a different email they can still accept the invitation."
                    )
                  : data.projectInvite.status === InviteStatus.Queued
                  ? t(
                      "Email cannot be changed because the invite is currently being sent."
                    )
                  : t(
                      "Email cannot be changed because the invite was already sent."
                    )
              }
              value={state.email}
              required
              onChange={updateState("email")}
            />
          </div>
          <div className="max-w-lg mb-4">
            <TextInput
              id="fullname"
              label={t("Full Name")}
              description={t("Optionally provide the recipient's name.")}
              value={state.fullname}
              onChange={updateState("fullname")}
            />
          </div>
          <div className="max-w-lg mb-4">
            <InputBlock
              className=""
              children={
                <p>
                  <Trans ns="admin">
                    Admins will be given full access to change project settings.
                    They can manage data layers, change access control settings,
                    and moderate the discussion forums.
                  </Trans>
                </p>
              }
              input={
                <Switch
                  isToggled={state.makeAdmin}
                  onClick={updateState("makeAdmin")}
                />
              }
              title={t("Assign Administrator Access")}
            />
          </div>
          <div className="max-w-lg mb-4">
            <GroupMultiSelect
              title={t("Assign Group Membership")}
              groups={(data?.currentProject?.groups || []).map((g) => ({
                value: g.id,
                label: g.name,
              }))}
              value={state.groups.map((g) => ({ label: g.name, value: g.id }))}
              loading={false}
              onChange={(v) => {
                // @ts-ignore
                setState((prev) => {
                  const groups = v.map((g) => ({
                    name: g.label,
                    id: g.value,
                  }));
                  return {
                    ...prev,
                    groups,
                    hasChanged: true,
                  };
                });
              }}
            />
          </div>
          <div className="max-w-lg mb-4">
            <h2 className="font-medium">{t("Email Status")}</h2>
            {data.projectInvite.inviteEmails.length === 0 && (
              <div className="text-sm mt-1">
                <Trans ns="admin">This invite has not yet been sent</Trans>
                <Button
                  disabled={sendInviteState.loading}
                  className="ml-2"
                  small
                  label={t("Send Invite Email")}
                  onClick={() => sendInvite()}
                />
              </div>
            )}
            {data.projectInvite.inviteEmails.length > 0 && (
              <div className="mt-2">
                {[...data.projectInvite.inviteEmails]
                  .sort((a, b) => {
                    return (
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                    );
                  })
                  .map((email, i) => (
                    <div key={`${i}`}>
                      <div className={`flex items-center h-6 text-sm py-5`}>
                        <InviteIcon
                          size={8}
                          wasUsed={data.projectInvite?.wasUsed}
                          tokenExpiresAt={email.tokenExpiresAt}
                          status={
                            (tokenExpired(email)
                              ? InviteStatus.TokenExpired
                              : (email.status as unknown)) as InviteStatus
                          }
                        />
                        <span className="flex-1 px-2">
                          {emailStatusText(email)}
                        </span>
                        <button
                          className="text-gray-500 underline"
                          onClick={() => {
                            if (expandedEmails[email.id]) {
                              setExpandedEmails({
                                ...expandedEmails,
                                [email.id]: false,
                              });
                            } else {
                              setExpandedEmails({
                                ...expandedEmails,
                                [email.id]: true,
                              });
                            }
                          }}
                        >
                          <Trans ns="admin">details</Trans>
                        </button>
                      </div>
                      <dl
                        className={`m-4 rounded border border-gray-200 ${
                          expandedEmails[email.id] ? "visible" : "hidden"
                        }`}
                      >
                        <div className="bg-gray-50 px-4 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 rounded-t">
                          <dt className="text-sm font-medium text-gray-500">
                            {t("Email Status")}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {email.status}
                          </dd>
                        </div>
                        <div className="bg-white px-4 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">
                            {t("Created At")}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {email.createdAt
                              ? new Date(email.createdAt).toLocaleString()
                              : "Unknown"}
                          </dd>
                        </div>
                        <div className="bg-gray-50 px-4 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">
                            {t("Last Updated")}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {email.updatedAt
                              ? new Date(email.updatedAt).toLocaleString()
                              : t("Never")}
                          </dd>
                        </div>
                        <div className="bg-white px-4 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">
                            {t("Recipient")}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {email.toAddress}
                          </dd>
                        </div>
                        <div className="bg-gray-50 px-4 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">
                            {t("Token Expires")}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {email.tokenExpiresAt
                              ? new Date(email.tokenExpiresAt).toLocaleString()
                              : t("Token not yet assigned")}
                          </dd>
                        </div>
                        <div className="bg-white px-4 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 rounded-b">
                          <dt className="text-sm font-medium text-gray-500">
                            {t("Errors")}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {email.error ? email.error : t("None")}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                {data.projectInvite.status !== InviteStatus.Queued && (
                  <Button
                    className="mt-4"
                    small
                    onClick={() => sendInvite()}
                    label={
                      data.projectInvite.status === InviteStatus.TokenExpired
                        ? t("Send another email")
                        : t("Send reminder email")
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function tokenExpired(email: Pick<InviteEmail, "tokenExpiresAt">) {
  if (email.tokenExpiresAt && new Date(email.tokenExpiresAt) < new Date()) {
    return true;
  } else {
    return false;
  }
}
