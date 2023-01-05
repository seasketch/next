import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { AuthorProfileFragment } from "../../generated/graphql";
import { nameForProfile } from "./TopicListItem";
import { Trans as I18n } from "react-i18next";
import { useContext } from "react";
import { ProjectAppSidebarContext } from "../ProjectAppSidebar";
const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function InlineAuthorDetails({
  profile,
  dateString,
  firstPostInTopic,
}: {
  profile: AuthorProfileFragment;
  dateString?: string;
  firstPostInTopic: boolean;
}) {
  const sidebarContext = useContext(ProjectAppSidebarContext);
  const date = dateString ? new Date(dateString) : null;
  return (
    <div className="flex items-center">
      <div className="w-6 h-6 flex items-center flex-none">
        <ProfilePhoto {...profile} canonicalEmail="" />
      </div>
      <div className="text-sm pl-2  space-x-1 flex items-center">
        <span
          className="font-semibold truncate inline-block"
          style={{
            maxWidth: sidebarContext.isSmall ? "11rem" : "13rem",
          }}
        >
          {nameForProfile(profile)}
        </span>
        {date && (
          <>
            <span className="inline-flex">
              {firstPostInTopic ? (
                <Trans>posted on</Trans>
              ) : (
                <Trans>replied on</Trans>
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
