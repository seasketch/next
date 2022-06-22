import React, { useCallback, useEffect, useRef, useState } from "react";
import { AutoSizer } from "react-virtualized";
import { FixedSizeList as List } from "react-window";
import Skeleton from "../../components/Skeleton";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import {
  InviteStatus,
  InviteDetailsFragment,
  useSendInvitesMutation,
  EmailStatus,
} from "../../generated/graphql";
import { useHistory } from "react-router";
import InviteRow from "./InviteRow";
import EditInviteModal from "./EditInviteModal";
import { SearchIcon } from "@heroicons/react/outline";
import Fuse from "fuse.js";
import { useHotkeys } from "react-hotkeys-hook";
import { XCircleIcon } from "@heroicons/react/solid";

interface Props {
  invites: InviteDetailsFragment[];
  projectId: number;
  slug: string;
  status: InviteStatus[];
  error?: Error;
}

function InviteList(props: Props) {
  const [openModalInviteId, setOpenModalInviteId] = useState<number>();
  const { t } = useTranslation("admin");
  const history = useHistory();
  const status = props.status;
  let invites = props.invites.filter((i) => status.indexOf(i.status!) !== -1);

  const [sendInvites] = useSendInvitesMutation({
    variables: {
      ids: invites.map((i) => i.id),
    },
    optimisticResponse: (vars) => {
      return {
        sendProjectInvites: {
          __typename: "SendProjectInvitesPayload",
          inviteEmails: invites.map((invite) => ({
            __typename: "InviteEmail",
            id: invite.id + 9999,
            createdAt: new Date().toISOString(),
            status: EmailStatus.Queued,
            toAddress: invite.email,
            projectInvite: {
              __typename: "ProjectInvite",
              id: invite.id,
              status: InviteStatus.Queued,
            },
          })),
        },
      };
    },
  });

  const searchBar = useRef<HTMLInputElement>(null);
  useHotkeys("ctrl+f, ⌘+f", (e) => {
    searchBar.current?.focus();
    e.preventDefault();
    return false;
  });
  const [query, setQuery] = useState("");
  const searchIndex = useRef<Fuse<InviteDetailsFragment>>();
  const [searchResults, setSearchResults] =
    useState<Fuse.FuseResult<InviteDetailsFragment>[]>();

  useEffect(() => {
    searchIndex.current = new Fuse(invites, {
      includeMatches: true,
      keys: ["fullname", "email"],
      isCaseSensitive: false,
      includeScore: true,
      threshold: 0.25,
      // minMatchCharLength: 2,
    });
  }, [invites]);

  useEffect(() => {
    if (searchIndex.current && query && query.length) {
      try {
        const q = query;
        const results = searchIndex.current.search(q);
        setSearchResults(results);
      } catch (e) {
        setSearchResults(undefined);
      }
    } else {
      setSearchResults(undefined);
    }
  }, [searchIndex, query]);

  const onModalRequestClose = useCallback(
    () => setOpenModalInviteId(undefined),
    [setOpenModalInviteId]
  );

  const count = invites.length;
  if (searchResults && invites) {
    const invitesById = invites.reduce((idx, invite) => {
      idx[invite.id.toString()] = invite;
      return idx;
    }, {} as { [id: string]: InviteDetailsFragment });
    invites = searchResults.map((res) => invitesById[res.item.id]);
    // invites = searchResults.map((res) => invitesById[res.item]);
  }

  const Row = useCallback(
    ({ index, style }: { index: number; style: any }) => {
      const invite = invites ? invites[index] : undefined;
      if (!invite) {
        return (
          <div
            style={style}
            className="w-full bg-white p-1 px-2 flex items-center relative border-b border-opacity-10"
          >
            <Skeleton className="w-full h-1/2 rounded" />
          </div>
        );
      } else {
        return (
          <InviteRow
            index={index}
            style={style}
            email={invite.email}
            id={invite.id}
            fullname={invite.fullname || ""}
            makeAdmin={invite.makeAdmin}
            groups={invite.groups || []}
            onClick={setOpenModalInviteId}
            status={invite.status!}
            matches={searchResults ? searchResults[index] : undefined}
          />
        );
      }
    },
    [invites, searchResults]
  );

  return (
    <div className="min-h-full flex-1 flex-col flex max-w-6xl border-r">
      <div
        className="flex-none shadow bg-cool-gray-50 p-2 flex"
        style={{ zIndex: 1 }}
      >
        {/* <Button small label={<Trans ns="admin">Invite Users</Trans>} /> */}
        <div className="px-3 max-w-xs">
          <label htmlFor="search" className="sr-only">
            <Trans ns="admin">Search</Trans>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div
              className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              aria-hidden="true"
            >
              <SearchIcon
                className="mr-3 h-4 w-4 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              ref={searchBar}
              type="text"
              name="search"
              id="search"
              className="focus:ring-blue-300 focus:border-blue-300 block w-full pl-9 sm:text-sm border-gray-300 rounded-md"
              placeholder={t("Search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div
              className={`${
                query?.length > 0 ? "visible" : "hidden"
              } cursor-pointer absolute inset-y-0 right-2 pl-3 flex items-center`}
              onClick={() => setQuery("")}
              aria-hidden="true"
            >
              <XCircleIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
        {status.length === 1 && status[0] === InviteStatus.Unsent && (
          <Button
            className="mt-1"
            label={<Trans ns="admin">Send All Invites</Trans>}
            onClick={() => {
              if (
                window.confirm(
                  t(
                    `Are you sure you want to email all {{count}} draft invites?`,
                    { count: invites.length }
                  )
                )
              ) {
                sendInvites();
                history.push(`/${props.slug}/admin/users/invites/sent`);
              }
            }}
          />
        )}
      </div>

      <div className="flex-grow overflow-y-auto">
        <AutoSizer>
          {({ width, height }) => (
            <>
              <List
                height={height}
                width={width}
                itemCount={searchResults && invites ? invites.length : count}
                itemSize={40}
              >
                {Row}
              </List>
              {props.error && (
                <span className="absolute z-10 top-0 w-full text-center mt-2">
                  {props.error.message}
                </span>
              )}
            </>
          )}
        </AutoSizer>
        {count === 0 && (
          <div className="mt-4 ml-auto mr-auto w-56 text-gray-500 text-center border-4 border-dashed rounded-lg p-4">
            <Trans ns="admin">None found</Trans>
          </div>
        )}
        {openModalInviteId && (
          <EditInviteModal
            id={openModalInviteId}
            slug={props.slug}
            onRequestClose={onModalRequestClose}
          />
        )}
      </div>
    </div>
  );
}

// InviteList.whyDidYouRender = true;
export default React.memo(InviteList);
