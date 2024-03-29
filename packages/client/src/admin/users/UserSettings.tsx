import { ApolloClient, useQuery, useSubscription } from "@apollo/client";
import { useContext, useEffect, useState } from "react";
import debounce from "lodash.debounce";

import { Route, useParams } from "react-router-dom";
import {
  InviteStatus,
  ProjectInviteEmailStatusSubscriptionDocument,
  UserSettingsListsQuery,
  UserSettingsListsDocument,
  InviteDetailsFragment,
  Group,
  ParticipantListDetailsFragment,
} from "../../generated/graphql";
import { AdminMobileHeaderContext } from "../AdminMobileHeaderContext";
import InviteList from "./InviteList";
import UserList from "./UserList";
import UserSettingsSidebar from "./UserSettingsSidebar";
import useProjectId from "../../useProjectId";

export const problemStatus = [
  InviteStatus.Complaint,
  InviteStatus.Error,
  InviteStatus.Unsubscribed,
  InviteStatus.TokenExpired,
  InviteStatus.Bounced,
];

export const sentStatus = [
  InviteStatus.Queued,
  InviteStatus.Sent,
  InviteStatus.Delivered,
  InviteStatus.Confirmed,
  InviteStatus.Unconfirmed,
];

export const unsentStatus = [InviteStatus.Unsent];

interface StatusChangeEvent {
  id: number;
  status: InviteStatus;
}
let statusUpdateQueue: { [id: number]: StatusChangeEvent } = {};
let client: ApolloClient<any>;

const debouncedUpdatedInviteStatus = (
  props: StatusChangeEvent & { client: ApolloClient<any> }
) => {
  client = props.client;
  statusUpdateQueue[props.id] = props;
  updateCache();
};

const updateCache = debounce(
  () => {
    const items = Object.values(statusUpdateQueue);
    statusUpdateQueue = {};
    for (const item of items) {
      client.cache.modify({
        id: client.cache.identify({ __typename: "ProjectInvite", id: item.id }),
        fields: {
          status() {
            return item.status;
          },
        },
        broadcast: items.indexOf(item) === items.length - 1,
      });
    }
  },
  50,
  {
    maxWait: 1000,
  }
);

function UserSettings() {
  const { slug } = useParams<{ slug: string }>();
  const projectId = useProjectId();
  const { setState: setHeaderState } = useContext(AdminMobileHeaderContext);

  const { data, loading, error } = useQuery<UserSettingsListsQuery>(
    UserSettingsListsDocument,
    {
      pollInterval: 15000,
      variables: {
        slug,
        projectId,
      },
    }
  );

  const [lists, setLists] = useState<{
    invites: InviteDetailsFragment[];
    groups: Pick<Group, "id" | "name">[];
    users: ParticipantListDetailsFragment[];
    accessRequests: ParticipantListDetailsFragment[];
  }>({ invites: [], groups: [], users: [], accessRequests: [] });
  useEffect(() => {
    if (
      data?.projectBySlug &&
      data?.projectBySlug?.invitesConnection.nodes &&
      data?.projectBySlug?.participants &&
      data?.projectBySlug?.groups &&
      data?.projectBySlug?.accessRequestsConnection
    ) {
      setLists({
        invites: [...data.projectBySlug.invitesConnection.nodes].sort(
          (a, b) => {
            return (a.fullname || a.email)!.localeCompare(
              b.fullname || b.email
            );
          }
        ),
        groups: [...data.projectBySlug.groups].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
        users: [
          ...[...data.projectBySlug.participants].sort((a, b) => {
            return (a.profile?.fullname || a.canonicalEmail)!.localeCompare(
              (b.profile?.fullname || b.canonicalEmail)!
            );
          }),
        ],
        accessRequests: [
          ...[...data.projectBySlug.accessRequestsConnection.nodes].sort(
            (a, b) => {
              return (a.profile?.fullname || a.canonicalEmail)!.localeCompare(
                (b.profile?.fullname || b.canonicalEmail)!
              );
            }
          ),
        ],
      });
    } else {
      setLists({
        invites: [],
        groups: [],
        users: [],
        accessRequests: [],
      });
    }
  }, [
    data?.projectBySlug?.invitesConnection,
    data?.projectBySlug?.participants,
    data?.projectBySlug?.groups,
    data?.projectBySlug,
  ]);

  useSubscription(ProjectInviteEmailStatusSubscriptionDocument, {
    onSubscriptionData: (data) => {
      const invite =
        data.subscriptionData.data.projectInviteStateUpdated.invite;
      debouncedUpdatedInviteStatus({
        id: invite.id,
        status: invite.status,
        client: data.client,
      });
    },
  });

  useEffect(() => {
    setHeaderState({
      heading: "Users & Groups",
    });
    return () => setHeaderState({});
  }, [setHeaderState]);
  return (
    <div className="flex min-h-screen">
      <UserSettingsSidebar
        invites={lists.invites}
        loading={loading}
        groups={lists.groups}
        users={lists.users}
        accessControl={data?.projectBySlug?.accessControl}
        projectId={data?.projectBySlug?.id}
        accessRequests={lists.accessRequests}
      />
      {error && <div className="p-8">{error.message}</div>}
      {!error && data?.projectBySlug?.id && (
        <>
          <Route path={`/${slug}/admin/users/participants`}>
            <UserList
              users={lists.users}
              projectId={data.projectBySlug.id}
              slug={slug}
              adminsOnly={false}
            />
          </Route>
          <Route path={`/${slug}/admin/users/admins`}>
            <UserList
              users={lists.users}
              projectId={data.projectBySlug.id}
              slug={slug}
              adminsOnly={true}
            />
          </Route>
          <Route path={`/${slug}/admin/users/accessRequests`}>
            <UserList
              users={lists.accessRequests}
              projectId={data.projectBySlug.id}
              slug={slug}
              adminsOnly={false}
            />
          </Route>
          <Route
            path={`/${slug}/admin/users/groups/:groupId`}
            render={(props) => (
              <UserList
                users={lists.users}
                projectId={data.projectBySlug!.id}
                slug={slug}
                adminsOnly={false}
                groupId={parseInt(props.match.params.groupId!)}
                groupName={
                  data?.projectBySlug?.groups.find(
                    (g) => g.id === parseInt(props.match.params.groupId!)
                  )?.name || ""
                }
              />
            )}
          ></Route>
          <Route
            path={`/${slug}/admin/users/invites/:status`}
            render={(props) => {
              let status: InviteStatus[] = sentStatus;
              switch (props.match.params.status) {
                case "sent":
                  status = sentStatus;
                  break;
                case "problems":
                  status = problemStatus;
                  break;
                case "pending":
                  status = unsentStatus;
                  break;
                default:
                  status = unsentStatus;
                  break;
              }
              return (
                <InviteList
                  invites={lists.invites}
                  status={status}
                  projectId={data.projectBySlug!.id}
                  slug={slug}
                  error={error}
                />
              );
            }}
          ></Route>
        </>
      )}
    </div>
  );
}

export default UserSettings;
