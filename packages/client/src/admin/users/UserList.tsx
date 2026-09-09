import { useCallback, useMemo, useRef, useState } from "react";
import { AutoSizer } from "react-virtualized";
import { FixedSizeList as List } from "react-window";
import ParticipantRow from "./ParticipantRow";
import Skeleton from "../../components/Skeleton";
import { Trans, useTranslation } from "react-i18next";
import ParticipantModal from "./ParticipantModal";
import Button from "../../components/Button";
import {
  useDeleteGroupMutation,
  useRenameGroupMutation,
  UserListDetailsFragment,
} from "../../generated/graphql";
import { useHistory } from "react-router";
import useDialog from "../../components/useDialog";
import { downloadCsv, usersExportFilename, usersToCsv } from "./exportCsv";
import Fuse from "fuse.js";
import { useHotkeys } from "react-hotkeys-hook";
import ListSearchInput from "./ListSearchInput";

interface UserListProps {
  users: UserListDetailsFragment[];
  projectId: number;
  slug: string;
  groupId?: number;
  groupName?: string;
  adminsOnly: boolean;
  accessRequests?: boolean;
}

export default function UserList(props: UserListProps) {
  const [openModalUserId, setOpenModalUserId] = useState<number>();
  const { t } = useTranslation("admin");
  const history = useHistory();

  const [deleteGroup] = useDeleteGroupMutation({
    variables: {
      groupId: props.groupId!,
    },
    refetchQueries: ["UserAdminCounts"],
    update: (cache, result) => {
      const id = cache.identify(result.data!.deleteGroup!.group!);
      cache.evict({ id });
      cache.gc();
    },
  });

  const [renameGroup] = useRenameGroupMutation();

  const participants = useMemo(() => {
    let users = props.users;
    if (props.adminsOnly) {
      users = users.filter((u) => u.isAdmin);
    }
    if (props.groupId) {
      users = users.filter(
        (u) => !!u.groups?.find((g) => g.id === props.groupId)
      );
    }
    return users;
  }, [props.users, props.adminsOnly, props.groupId]);

  const searchBar = useRef<HTMLInputElement>(null);
  useHotkeys("ctrl+f, ⌘+f", (e) => {
    searchBar.current?.focus();
    e.preventDefault();
    return false;
  });
  const [query, setQuery] = useState("");
  const searchIndex = useMemo(
    () =>
      new Fuse(participants, {
        includeMatches: true,
        keys: [
          "profile.fullname",
          "profile.nickname",
          "profile.email",
          "canonicalEmail",
          "groups.name",
        ],
        isCaseSensitive: false,
        includeScore: true,
        threshold: 0.25,
      }),
    [participants]
  );
  const searchResults = useMemo(() => {
    if (!query) {
      return undefined;
    }
    try {
      return searchIndex.search(query);
    } catch (e) {
      return undefined;
    }
  }, [query, searchIndex]);

  const displayed = searchResults
    ? searchResults.map((result) => result.item)
    : participants;

  const Row = useCallback(
    ({ index, style }: { index: number; style: any }) => {
      const user = displayed ? displayed[index] : undefined;
      if (!user) {
        return (
          <div
            style={style}
            className="w-full bg-white p-1 px-2 flex items-center relative border-b border-opacity-10"
          >
            <Skeleton className="w-6 h-6 rounded-full mr-2" />
            <Skeleton className="w-full h-1/2 rounded" />
          </div>
        );
      } else {
        return (
          <ParticipantRow
            index={index}
            style={style}
            picture={user.profile?.picture || undefined}
            email={user.profile?.email}
            fullname={user.profile?.fullname || undefined}
            isAdmin={!!user.isAdmin}
            canonicalEmail={user.canonicalEmail!}
            groups={(user.groups || []).map((g) => g.name!)}
            onClick={() => setOpenModalUserId(user.id)}
            isBanned={user.bannedFromForums || false}
            needsApproval={user.needsAccessRequestApproval || false}
            approved={Boolean(user.approvedBy)}
            denied={Boolean(user.deniedBy)}
            matches={searchResults ? searchResults[index] : undefined}
          />
        );
      }
    },
    [displayed, searchResults]
  );

  const { prompt, confirmDelete } = useDialog();

  return (
    <div className="min-h-full flex-1 flex-col flex w-full min-w-0">
      <div
        className="flex-none shadow bg-cool-gray-50 px-3 py-2 flex items-center space-x-2"
        style={{ zIndex: 1 }}
      >
        <ListSearchInput
          id="user-search"
          value={query}
          onChange={setQuery}
          inputRef={searchBar}
        />
        {props.groupId && (
          <>
            <Button
              label={t("Rename Group")}
              onClick={() => {
                prompt({
                  message: "Enter a new group name",
                  defaultValue: props.groupName,
                  onSubmit: async (value) => {
                    if (!value || value.length < 1) {
                      throw new Error(t("You must specify a group name"));
                    } else {
                      try {
                        await renameGroup({
                          variables: {
                            name: value,
                            id: props.groupId!,
                          },
                          optimisticResponse: {
                            updateGroup: {
                              group: {
                                id: props.groupId!,
                                name: value,
                              },
                            },
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
                    }
                  },
                });
              }}
            />
            <Button
              label={t("Delete Group")}
              onClick={() => {
                confirmDelete({
                  message: t("Are you sure you want to delete this group?"),
                  description: t("This action cannot be undone."),
                  onDelete: async () => {
                    await deleteGroup();
                    history.push(`/${props.slug}/admin/users/`);
                  },
                });
              }}
            />
          </>
        )}
        <div className="flex-1" />
        <Button
          disabled={displayed.length === 0}
          label={t("Export to CSV")}
          onClick={() => {
            downloadCsv(usersExportFilename(props), usersToCsv(displayed));
          }}
        />
      </div>

      <div className="flex-grow overflow-y-auto">
        <AutoSizer>
          {({ width, height }) => (
            <>
              <List
                height={height}
                width={width}
                itemCount={displayed.length}
                itemSize={40}
              >
                {Row}
              </List>
            </>
          )}
        </AutoSizer>
        {displayed.length === 0 && (
          <div className="mt-4 ml-auto mr-auto w-56 text-gray-500 text-center border-4 border-dashed rounded-lg p-4">
            {query ? (
              <Trans ns="admin">None found</Trans>
            ) : (
              <Trans ns="admin">This group has no users</Trans>
            )}
          </div>
        )}
        {openModalUserId && (
          <ParticipantModal
            userId={openModalUserId}
            projectSlug={props.slug}
            onRequestClose={() => setOpenModalUserId(undefined)}
            projectId={props.projectId}
          />
        )}
      </div>
    </div>
  );
}
