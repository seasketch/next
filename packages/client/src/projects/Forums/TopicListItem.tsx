import {
  AuthorProfileFragment,
  ForumTopicFragment,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import { formatTimeAgo } from "../../admin/data/CreateBasemapModal";
import { Link } from "react-router-dom";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { useCallback, useContext } from "react";
import { ForumBreadcrumbState } from "./Forums";
const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function TopicListItem({
  topic,
}: {
  topic: ForumTopicFragment;
}) {
  const hasReplies = topic.postsCount && topic.postsCount > 1;
  const timeAgo = formatTimeAgo(
    new Date(topic.lastPostDate || topic.createdAt)
  );
  const lastAuthor = nameForProfile(topic.lastAuthor?.profile);
  const profiles =
    topic.participantsConnection.nodes
      .filter((p) => Boolean(p.profile))
      .map((p) => p.profile!) || [];

  return (
    <div className="">
      <div className="flex">
        <div className="flex-1">
          <Link to={`./${topic.forumId}/${topic.id}`}>
            <h4 className="text-base font-semibold">
              <Link to={`./${topic.forumId}/${topic.id}`}>{topic.title}</Link>
            </h4>
            <p className="text-sm truncate overflow-hidden whitespace-nowrap topic-blurb text-gray-500">
              <Link to={`./${topic.forumId}/${topic.id}`}>{topic.blurb}</Link>
            </p>
            <div
              title={new Date(
                topic.lastPostDate || topic.createdAt
              ).toLocaleString()}
              className="text-sm text-primary-800 opacity-90"
            >
              {hasReplies ? (
                <Trans>
                  Last reply {timeAgo} by {lastAuthor}
                </Trans>
              ) : (
                <Trans>
                  Posted {timeAgo} by {lastAuthor}
                </Trans>
              )}
            </div>
          </Link>
        </div>
        <Link to={`./${topic.forumId}/${topic.id}`}>
          <ParticipantAvatarCollection profiles={profiles} />
        </Link>
      </div>
    </div>
  );
}

export function nameForProfile(profile?: AuthorProfileFragment | null) {
  return profile?.nickname || profile?.fullname || profile?.email;
}

export function ParticipantAvatarCollection({
  profiles,
}: {
  profiles: AuthorProfileFragment[];
}) {
  if (profiles.length === 1) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-10 h-10">
          <ProfilePhoto
            email={profiles[0].email}
            fullname={profiles[0].fullname}
            picture={profiles[0].picture}
            canonicalEmail=""
          />
        </div>
        {/* <div className="text-xs">
          <Trans>1 author</Trans>
        </div> */}
      </div>
    );
  } else {
    return (
      <div>
        {profiles.map((p) => (
          <div className="w-10 h-10">
            <ProfilePhoto
              email={profiles[0].email}
              fullname={profiles[0].fullname}
              picture={profiles[0].picture}
              canonicalEmail=""
            />
          </div>
        ))}
      </div>
    );
  }
}
