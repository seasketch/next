import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useHistory, useParams } from "react-router";
import InviteRow from "./InviteRow";
import EditInviteModal from "./EditInviteModal";
import Fuse from "fuse.js";
import { useHotkeys } from "react-hotkeys-hook";
import useDialog from "../../components/useDialog";
import { downloadCsv, invitesExportFilename, invitesToCsv } from "./exportCsv";
import ListSearchInput from "./ListSearchInput";

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

  const [sendInvites, sendInvitesState] = useSendInvitesMutation({
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

  const { confirm } = useDialog();

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
    <div className="min-h-full flex-1 flex-col flex w-full min-w-0">
      <div
        className="flex-none shadow bg-cool-gray-50 px-3 py-2 flex items-center space-x-2"
        style={{ zIndex: 1 }}
      >
        <ListSearchInput
          value={query}
          onChange={setQuery}
          inputRef={searchBar}
        />
        {status.length === 1 && status[0] === InviteStatus.Unsent && (
          <Button
            label={<Trans ns="admin">Send All Invites</Trans>}
            onClick={async () => {
              if (
                await confirm(
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
        <div className="flex-1" />
        <Button
          disabled={invites.length === 0}
          label={t("Export to CSV")}
          onClick={() => {
            downloadCsv(
              invitesExportFilename(props.slug, status),
              invitesToCsv(invites)
            );
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
