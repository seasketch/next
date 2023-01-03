import JoinProjectPrompt from "../../auth/JoinProjectPrompt";
import { Trans as I18n, useTranslation } from "react-i18next";
import { useForumsQuery } from "../../generated/graphql";
import getSlug from "../../getSlug";
import ForumListItem from "./ForumListItem";
import Skeleton from "../../components/Skeleton";
import { useEffect, useState } from "react";
import ForumBreadcrumbs from "./ForumBreadcrumbs";
import TopicList from "./TopicList";
import { useRouteMatch } from "react-router-dom";
import NewTopicForm from "./NewTopicForm";
import { createContext } from "vm";
import Topic from "./Topic";
const Trans = (props: any) => <I18n ns="forums" {...props} />;

export type ForumBreadcrumb = { name: string; id: number };

export const BreadcrumbContext = createContext();

export interface ForumBreadcrumbState {
  forum?: ForumBreadcrumb;
  topic?: ForumBreadcrumb;
  canPost?: boolean;
}

export default function Forums({
  hidden,
  forumId,
  topicId,
  postNewTopic,
}: {
  hidden?: boolean;
  forumId?: number;
  topicId?: number;
  postNewTopic?: boolean;
}) {
  const slug = getSlug();

  const { data, loading } = useForumsQuery({
    variables: {
      slug,
    },
  });

  if (hidden) {
    return null;
  }
  if (!data && loading) {
    return (
      <div className="pt-2 space-y-3">
        <Skeleton className="w-1/2 h-5" />
        <Skeleton className="w-3/4 h-5" />
        <Skeleton className="w-1/2 h-5" />
        <Skeleton className="w-2/3 h-5" />
        <Skeleton className="w-1/2 h-5" />
        <Skeleton className="w-2/3 h-5" />
        <Skeleton className="w-1/2 h-5" />
        <Skeleton className="w-2/3 h-5" />
      </div>
    );
  }

  return (
    <div className="">
      {forumId && (
        <ForumBreadcrumbs
          postingNewTopic={postNewTopic}
          forumId={forumId}
          topicId={topicId}
        />
      )}
      {!forumId && (
        <>
          <div className="space-y-4 p-4">
            {(data?.projectBySlug?.forums || []).map((f) => (
              <ForumListItem key={f.id} forum={f} />
            ))}
          </div>
          {(data?.projectBySlug?.latestPostsConnection.nodes || []).length >
            0 && (
            <div className="mt-1 p-4">
              <h2 className="font-semibold">
                <Trans>Latest Discussions</Trans>
              </h2>
            </div>
          )}
          <div className="pt-8 p-4">
            <JoinProjectPrompt variant="forums" />
          </div>
        </>
      )}
      {forumId && !topicId && !postNewTopic && <TopicList forumId={forumId} />}
      {forumId && postNewTopic && data?.me?.profile && (
        <NewTopicForm forumId={forumId} profile={data.me.profile} />
      )}
      {topicId && <Topic id={topicId} />}
    </div>
  );
}
