import { RecentPostFragment } from "../../generated/graphql";
import { formatTimeAgo } from "../../admin/data/CreateBasemapModal";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { nameForProfile } from "./TopicListItem";
import { Link } from "react-router-dom";
import getSlug from "../../getSlug";
import { Trans } from "react-i18next";
import { useTranslatedProps } from "../../components/TranslatedPropControl";

export default function RecentPostItem({ post }: { post: RecentPostFragment }) {
  const replyCount = (post.topic!.postsCount || 1) - 1;
  const timeAgo = formatTimeAgo(new Date(post.createdAt));
  const getTranslatedProp = useTranslatedProps();
  return (
    <Link
      to={`/${getSlug()}/app/forums/${post.topic!.forum!.id}/${
        post.topicId
      }#post-${post.id}`}
      className="flex items-start"
    >
      <div className="flex-none w-16 p-2 -ml-2 mr-1 h-16 text-sm flex-col items-center justify-center text-center">
        <ProfilePhoto canonicalEmail="" {...post.authorProfile!} />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="truncate whitespace-nowrap text-sm font-semibold">
          {nameForProfile(post.authorProfile!)}{" "}
          <span className="font-medium text-gray-500">{timeAgo}</span>
        </div>
        <h3 className="text-sm truncate text-gray-500">
          <Trans ns="homepage">
            Posted in <span className="font-semibold">{post.topic!.title}</span>
          </Trans>
        </h3>
        {<p className="truncate whitespace-nowrap">{post.blurb}</p>}
        <h4 className="text-sm text-gray-500 truncate">
          <span className="font-semibold">
            {getTranslatedProp("name", post.topic!.forum!)}
          </span>
          .{" "}
          <Trans ns="homepage" i18nKey="ReplyCount" count={replyCount}>
            {{ count: replyCount }} replies
          </Trans>
        </h4>
      </div>
    </Link>
  );
}
