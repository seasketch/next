import { Link } from "react-router-dom";
import { Trans } from "react-i18next";
import Badge from "../../components/Badge";
import { ForumListDetailsFragment } from "../../generated/graphql";
import { formatTimeAgo } from "../../admin/data/CreateBasemapModal";
import { useContext } from "react";
import { ProjectAppSidebarContext } from "../ProjectAppSidebar";
import { useTranslatedProps } from "../../components/TranslatedPropControl";

export default function ForumListItem({
  forum,
}: {
  forum: ForumListDetailsFragment;
}) {
  const { isSmall } = useContext(ProjectAppSidebarContext);
  const getTranslatedProp = useTranslatedProps(forum);

  return (
    <Link
      to={"./forums/" + forum.id}
      className="block bg-primary-800 bg-gradient-to-bl from-gray-700 to-primary-800 hover:from-gray-800 transition-all duration-300 text-white p-4 rounded hover:shadow-lg shadow-md group cursor-pointer"
      style={{ transition: "all" }}
    >
      <h3 className="text-base font-semibold">{getTranslatedProp("name")}</h3>
      {forum.description && (
        <p className="text-sm opacity-80">{getTranslatedProp("description")}</p>
      )}
      <div className="space-x-1">
        {!isSmall && (
          <Badge className="">
            <Trans
              ns="homepage"
              i18nKey="NumTopics"
              count={forum.topicCount || 0}
            >
              {{ count: forum.topicCount || 0 }} topics
            </Trans>
          </Badge>
        )}

        {!isSmall && (
          <Badge className="">
            <Trans
              ns="homepage"
              i18nKey="NumPosts"
              count={forum.postCount || 0}
            >
              {{ count: forum.postCount || 0 }} posts
            </Trans>
          </Badge>
        )}

        {forum.lastPostDate && (
          <Badge>
            <Trans ns="homepage">Latest activity</Trans>{" "}
            {formatTimeAgo(new Date(forum.lastPostDate))}
          </Badge>
        )}
      </div>
    </Link>
  );
}
