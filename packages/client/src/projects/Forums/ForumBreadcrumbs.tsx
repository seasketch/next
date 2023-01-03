import { HomeIcon } from "@heroicons/react/solid";
import { Link, NavLink } from "react-router-dom";
import getSlug from "../../getSlug";
import { ForumBreadcrumbState } from "./Forums";
import { Trans as I18n, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { PlusIcon } from "@heroicons/react/outline";
import {
  ForumTopicFragment,
  ForumTopicFragmentDoc,
  useBreadcrumbTopicQuery,
  useForumsQuery,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useEffect, useMemo } from "react";
import { useApolloClient } from "@apollo/client";
const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function ForumBreadcrumbs({
  postingNewTopic,
  topicId,
  forumId,
}: {
  postingNewTopic?: boolean;
  topicId?: number | null;
  forumId?: number | null;
}) {
  const slug = getSlug();
  const { t } = useTranslation("forums");
  const onError = useGlobalErrorHandler();

  const forumData = useForumsQuery({
    onError,
    variables: {
      slug: getSlug(),
    },
  });

  const topicData = useBreadcrumbTopicQuery({
    variables: {
      topicId: topicId || 0,
    },
    errorPolicy: "ignore",
    fetchPolicy: "cache-first",
  });

  const forum = useMemo(() => {
    return (forumData.data?.projectBySlug?.forums || []).find(
      (f) => f.id === forumId
    );
  }, [forumData.data?.projectBySlug?.forums, forumId]);

  const client = useApolloClient();

  const topic = useMemo(() => {
    if (topicData.data?.topic) {
      return topicData.data?.topic;
    } else if (topicId) {
      return client.cache.readFragment({
        fragment: ForumTopicFragmentDoc,
        // eslint-disable-next-line i18next/no-literal-string
        id: `Topic:${topicId}`,
        fragmentName: "ForumTopic",
      }) as ForumTopicFragment;
    } else {
      return undefined;
    }
  }, [topicData.data?.topic, topicId, client.cache]);

  const canPost = useMemo(() => {
    return forum && forum.canPost;
  }, [forum]);

  return (
    <div className="flex w-full overflow-hidden bg-gray-100 p-2 px-4 text-sm font-semibold border-b shadow-sm h-10 items-center">
      <div className="flex items-center w-full overflow-hidden">
        <BreadcrumbLink
          className="flex-none"
          to={`/${slug}/app/forums`}
          label={t("Forums")}
        />
        {forum && (
          <BreadcrumbLink
            showSlash
            to={`/${slug}/app/forums/${forumId}`}
            label={forum.name}
            className=""
          />
        )}
        {/* {topic && forum && (
          <BreadcrumbLink
            showSlash
            to={`/${slug}/app/forums/${forum.id}/${topic.id}`}
            label={topic.title}
            className=""
          />
        )} */}
        {postingNewTopic && (
          <BreadcrumbLink
            showSlash
            className="flex-none"
            to={`/${slug}/app/forums/${forum?.id}/new-post`}
            label={t("New Topic")}
          />
        )}
      </div>
      {!topicId && forumId && canPost && !postingNewTopic && (
        <div className="flex-none text-right">
          <Button
            small
            href={`./${forumId}/new-post`}
            label={
              <>
                {t("Post a topic")}
                <PlusIcon className="w-4 h-4 ml-1" />
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

function BreadcrumbLink({
  to,
  label,
  showSlash,
  className,
}: {
  to: string;
  label: string;
  showSlash?: boolean;
  className?: string;
}) {
  return (
    <>
      {showSlash && <span className="mx-1 text-gray-500">/</span>}
      <NavLink
        exact
        className={(active) =>
          `truncate ${active ? "" : "underline"} ${className}`
        }
        activeClassName={"cursor-default"}
        to={to}
      >
        {label}
      </NavLink>
    </>
  );
}
