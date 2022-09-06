import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useHistory } from "react-router";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import TextInput from "../../components/TextInput";
import {
  InviteStatus,
  useCreateProjectInvitesMutation,
  useUserAdminCountsQuery,
} from "../../generated/graphql";
import GroupMultiSelect from "./GroupMultiSelect";
import Papa from "papaparse";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import { Tab } from "@headlessui/react";

export default function InviteUsersModal({
  projectId,
  slug,
  groupName,
  onRequestClose,
}: {
  projectId: number;
  slug: string;
  groupName?: string;
  onRequestClose: () => void;
}) {
  const history = useHistory();
  const { t } = useTranslation("admin");
  const [state, setState] = useState<{
    isAdmin: boolean;
    email: string;
    fullname: string;
    groupNames: string[];
    errors: { email?: string };
    sendEmailNow: boolean;
    multi: boolean;
    userDetails: { email: string; fullname?: string }[];
    textareaValue: string;
  }>({
    isAdmin: false,
    email: "",
    fullname: "",
    groupNames: groupName ? [groupName] : [],
    errors: {},
    sendEmailNow: false,
    multi: false,
    userDetails: [],
    textareaValue: "email,name",
  });
  const { data, loading } = useUserAdminCountsQuery({
    variables: {
      slug,
    },
  });

  const [createInvites, createInvitesState] = useCreateProjectInvitesMutation({
    variables: {
      projectId,
      makeAdmin: state.isAdmin,
      groupNames: state.groupNames,
      sendEmailNow: state.sendEmailNow,
      userDetails: state.multi
        ? state.userDetails
        : [
            {
              email: state.email,
              fullname: state.fullname,
            },
          ],
    },
    // @ts-ignore
    optimisticResponse: () => {
      const res = {
        createProjectInvites: {
          __typename: "CreateProjectInvitesPayload",
          projectInvites: [
            {
              id: 99999,
              createdAt: new Date().toISOString(),
              email: state.email,
              fullname: state.fullname,
              groups: state.groupNames.map((name) => ({
                name,
                id: data?.projectBySlug?.groups.find((g) => g.name === name)!
                  .id!,
                __typename: "Group",
              })),
              status: state.sendEmailNow
                ? InviteStatus.Queued
                : InviteStatus.Unsent,
              makeAdmin: state.isAdmin,
              wasUsed: false,
              __typename: "ProjectInvite",
            },
          ],
        },
      };
      return res;
    },
    update: (cache, mutationResult) => {
      cache.modify({
        id: cache.identify(data!.projectBySlug!),
        fields: {
          invitesConnection(existingConnection) {
            const newInvites =
              mutationResult.data?.createProjectInvites?.projectInvites || [];
            if (newInvites.length) {
              return {
                ...existingConnection,
                nodes: [...existingConnection.nodes, ...newInvites],
              };
            }
          },
        },
      });
    },
    // refetchQueries: ["UserAdminCounts", "ProjectInvites"],
  });

  useEffect(() => {
    if (createInvitesState.error) {
      const message = createInvitesState.error.message;
      setState((prev) => ({ ...prev, errors: { email: message } }));
    }
  }, [createInvitesState.error]);

  return (
    <Modal
      disableBackdropClick={true}
      loading={loading || createInvitesState.loading}
      tabs={[t("Single Invite"), t("List Multiple")]}
      title={t("Invite Users")}
      onRequestClose={onRequestClose}
      onTabChange={(selectedIndex) => {
        setState((prev) => ({
          ...prev,
          multi: selectedIndex === 1,
        }));
      }}
      scrollable={true}
      footer={[
        {
          label: t("Submit"),
          variant: "primary",
          disabled: createInvitesState.loading,
          onClick: () => {
            createInvites()
              .then(() => {
                onRequestClose();
                const status = state.sendEmailNow ? "sent" : "pending";
                history.push(`/${slug}/admin/users/invites/${status}`);
              })
              .catch((e) => console.error(e));
          },
        },
        {
          label: t("Cancel"),
          onClick: onRequestClose,
          disabled: createInvitesState.loading,
        },
      ]}
    >
      <div className="w-full sm:w-auto text-left">
        <Tab.Panels>
          <Tab.Panel>
            <div className="mb-4">
              <TextInput
                name="recipient"
                type="email"
                label={t("Email")}
                description={t(
                  "The invitation will be sent here. If the recipient would like to register using a different email they can still accept the invitation."
                )}
                value={state.email}
                required
                error={state.errors.email}
                onChange={(email) =>
                  setState((prev) => ({
                    ...prev,
                    email,
                    errors: { ...prev.errors, email: undefined },
                  }))
                }
              />
            </div>
            <div className="mb-4">
              <TextInput
                name="fullname"
                label={t("Full Name")}
                description={t("Optionally provide the recipient's name.")}
                value={state.fullname}
                onChange={(fullname) =>
                  setState((prev) => ({ ...prev, fullname }))
                }
              />
            </div>
          </Tab.Panel>
          <Tab.Panel>
            <>
              <div className="mb-4">
                <InputBlock
                  title={
                    <span className="flex items-center">
                      {t("Email List")}{" "}
                      <Badge
                        className="ml-2"
                        variant={
                          state.userDetails.length > 0 ? "primary" : "secondary"
                        }
                      >
                        {state.userDetails.length}
                      </Badge>
                    </span>
                  }
                  flexDirection="column"
                  children={
                    <>
                      <p className="mb-2">
                        <Trans ns="admin">
                          Enter comma-separated values for user emails and names
                          below. Order matters. You may find it easiest to copy
                          and paste from a spreadsheet.
                        </Trans>
                      </p>
                      {createInvitesState.error && (
                        <p className="text-red-700 mb-2">
                          {createInvitesState.error.message}
                        </p>
                      )}
                    </>
                  }
                  input={
                    <textarea
                      rows={5}
                      className="rounded border-gray-300 outline-none w-full text-sm"
                      id="emailList"
                      name="emailList"
                      value={state.textareaValue}
                      onChange={(e) => {
                        const parsed = Papa.parse<[string, string]>(
                          e.target.value
                        );
                        let rows = parsed.data.filter(
                          (row) => row.length > 0 && row[0].length > 0
                        );
                        if (
                          rows.length &&
                          rows[0][0] === "email" &&
                          rows[0][1] === "name"
                        ) {
                          rows = rows.slice(1);
                        }
                        setState((prev) => ({
                          ...prev,
                          textareaValue: e.target.value,
                          userDetails: rows.map((row) => ({
                            email: row[0].trim(),
                            fullname: row[1] ? row[1].trim() : undefined,
                          })),
                        }));
                      }}
                    />
                  }
                />
              </div>
            </>
          </Tab.Panel>

          <div className="mb-4">
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
                  isToggled={state.isAdmin}
                  onClick={(isAdmin) =>
                    setState((prev) => ({ ...prev, isAdmin }))
                  }
                />
              }
              title={t("Assign Administrator Access")}
            />
          </div>
          <div className="mb-4">
            <GroupMultiSelect
              title={t("Assign Group Membership")}
              groups={(data?.projectBySlug?.groups || []).map((g) => ({
                value: g.id,
                label: g.name,
              }))}
              value={state.groupNames
                .map(
                  (name) =>
                    (data?.projectBySlug?.groups || []).find(
                      (g) => g.name === name
                    )!
                )
                .map((g) => ({ label: g.name, value: g.id }))}
              loading={false}
              onChange={(v) =>
                setState((prev) => ({
                  ...prev,
                  groupNames: v.map((g) => g.label),
                }))
              }
            />
          </div>
          <div className="mb-4">
            <InputBlock
              className=""
              children={
                <p>
                  <Trans ns="admin">
                    You may choose to send the invitation email immediately, or
                    send them later.
                  </Trans>
                </p>
              }
              input={
                <Switch
                  isToggled={state.sendEmailNow}
                  onClick={(sendEmailNow) =>
                    setState((prev) => ({ ...prev, sendEmailNow }))
                  }
                />
              }
              title={t("Send Email Now")}
            />
          </div>
        </Tab.Panels>
      </div>
    </Modal>
  );
}
