import {
  AuthorProfileFragment,
  ForumTopicFragment,
} from "../../generated/graphql";
import { Trans } from "react-i18next";
import { formatTimeAgo } from "../../admin/data/CreateBasemapModal";
import { Link } from "react-router-dom";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { useContext } from "react";
import { ProjectAppSidebarContext } from "../ProjectAppSidebar";

export default function TopicListItem({
  topic,
}: {
  topic: ForumTopicFragment;
}) {
  const hasReplies = topic.postsCount && topic.postsCount > 1;
  const timeAgo = formatTimeAgo(
    new Date(topic.lastPostDate || topic.createdAt)
  );
  const lastAuthor = nameForProfile(topic.authorProfile);
  const profiles = [...topic.participantsConnection.nodes].reverse();
  const { isSmall } = useContext(ProjectAppSidebarContext);

  return (
    <div className="">
      <div className="flex">
        <div className="flex-1 overflow-hidden">
          <Link to={`./${topic.forumId}/${topic.id}`}>
            <h4 className="text-base font-semibold">
              <Link to={`./${topic.forumId}/${topic.id}`}>
                {topic.title || (
                  <span className="text-gray-500">
                    <Trans ns="forums">Untitled</Trans>
                  </span>
                )}
              </Link>
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
                <Trans i18nKey="lastReply" ns="forums">
                  Last reply {{ timeAgo }}. Started by {{ lastAuthor }}
                </Trans>
              ) : (
                <Trans i18nKey="postedAt" ns="forums">
                  Posted {{ timeAgo }} by {{ lastAuthor }}
                </Trans>
              )}
            </div>
          </Link>
        </div>
        <Link
          className="flex-none pl-2 flex flex-col text-xs items-center justify-center"
          to={`./${topic.forumId}/${topic.id}`}
        >
          <ParticipantAvatarCollection
            limit={isSmall ? 3 : 4}
            profiles={profiles}
          />
          {(topic.participantCount || 0) > 1 && (
            <span>
              <Trans
                i18nKey="participantCount"
                count={topic.participantCount || 0}
                ns="forums"
              >
                {{ count: topic.participantCount }} people
              </Trans>
            </span>
          )}
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
  limit,
}: {
  profiles: AuthorProfileFragment[];
  limit?: number;
}) {
  limit = limit || 4;
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
          <Trans ns="forums">1 author</Trans>
        </div> */}
      </div>
    );
  } else {
    return (
      <div
        className="whitespace-nowrap flex-nowrap items-center flex-col-reverse"
        style={{ width: 20 * profiles.slice(0, limit).length + 20 }}
      >
        {profiles.slice(0, limit).map((p, i) => (
          <div
            className="w-10 h-10 inline-block -mr-5"
            style={{
              zIndex: 5 - i,
            }}
            key={p.userId}
          >
            <ProfilePhoto
              border
              email={p.email}
              fullname={p.fullname}
              picture={p.picture}
              canonicalEmail=""
            />
          </div>
        ))}
      </div>
    );
  }
}
