import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { AuthorProfileFragment } from "../../generated/graphql";
import { nameForProfile } from "./TopicListItem";
import { MouseEvent, useCallback, useContext } from "react";
import { ProjectAppSidebarContext } from "../ProjectAppSidebar";
import { Trans } from "react-i18next";

export default function InlineAuthorDetails({
  profile,
  dateString,
  firstPostInTopic,
  onProfileClick,
}: {
  profile: AuthorProfileFragment;
  dateString?: string;
  firstPostInTopic: boolean;
  onProfileClick?: (
    e: MouseEvent<HTMLElement>,
    profile: AuthorProfileFragment
  ) => void;
}) {
  const sidebarContext = useContext(ProjectAppSidebarContext);
  const date = dateString ? new Date(dateString) : null;

  const onClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (onProfileClick) {
        onProfileClick(e, profile);
      }
    },
    [onProfileClick, profile]
  );
  return (
    <div className="flex items-center">
      <button onClick={onClick} className="w-6 h-6 flex items-center flex-none">
        <ProfilePhoto {...profile} canonicalEmail="" />
      </button>
      <div className="text-sm pl-2  space-x-1 flex items-center">
        <button
          onClick={onClick}
          className="font-semibold truncate inline-block hover:underline"
          style={{
            maxWidth: sidebarContext.isSmall ? "11rem" : "13rem",
          }}
        >
          {nameForProfile(profile)}
        </button>
        {date && (
          <>
            <span className="inline-flex">
              {firstPostInTopic ? (
                <Trans ns="forums">posted on</Trans>
              ) : (
                <Trans ns="forums">replied on</Trans>
              )}
            </span>
            <span className="inline-flex" title={dateString}>
              {" " +
                (sidebarContext.isSmall
                  ? date.toLocaleDateString()
                  : date.toLocaleTimeString([], {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }))}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
