import { Trans } from "react-i18next";
import {
  ForumsDocument,
  TopicDetailDocument,
  TopicDetailQuery,
  useForumsQuery,
  useNewPostsSubscription,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import ForumListItem from "./ForumListItem";
import Skeleton from "../../components/Skeleton";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import ForumBreadcrumbs from "./ForumBreadcrumbs";
import TopicList from "./TopicList";
import { useRouteMatch } from "react-router-dom";
import NewTopicForm from "./NewTopicForm";
import { createContext } from "vm";
import Topic from "./Topic";
import useSessionStorage from "../../useSessionStorage";
import RecentPostItem from "./RecentPostItem";
import Warning from "../../components/Warning";
import { TopicListDocument } from "../../generated/queries";

export type ForumBreadcrumb = { name: string; id: number };

export const BreadcrumbContext = createContext();

export interface ForumBreadcrumbState {
  forum?: ForumBreadcrumb;
  topic?: ForumBreadcrumb;
  canPost?: boolean;
}

export function getLastFormUrl() {
  // eslint-disable-next-line i18next/no-literal-string
  const item = window.sessionStorage.getItem(`${getSlug()}-last-forum-url`);
  if (item && item.length && !/undefined/.test(item)) {
    return JSON.parse(item) as string;
  } else {
    return null;
  }
}

export function useLastForumUrl(): [
  string | undefined | null,
  Dispatch<SetStateAction<string>>
] {
  const slug = getSlug();
  const route = useRouteMatch();

  const [lastUrl, setLastUrl] = useSessionStorage(
    // eslint-disable-next-line i18next/no-literal-string
    `${slug}-last-forum-url`,
    route?.url
  );
  return [lastUrl, setLastUrl];
}

export default function Forums({
  hidden,
  postNewTopic,
  ...props
}: {
  hidden?: boolean;
  forumId?: number;
  topicId?: number;
  postNewTopic?: boolean;
}) {
  const slug = getSlug();
  const route = useRouteMatch();

  const [{ forumId, topicId }, setState] = useState<{
    forumId: number | undefined;
    topicId: number | undefined;
  }>({ forumId: undefined, topicId: undefined });

  useEffect(() => {
    if (hidden) {
      // do nothing
    } else {
      setState({ forumId: props.forumId, topicId: props.topicId });
    }
  }, [hidden, props.forumId, props.topicId]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastUrl, setLastUrl] = useLastForumUrl();

  useEffect(() => {
    if (route?.url) {
      setLastUrl(route.url);
    }
  }, [setLastUrl, route?.url]);

  const { data, loading, refetch } = useForumsQuery({
    variables: {
      slug,
    },
    pollInterval: 60000,
    fetchPolicy: "cache-and-network",
  });

  useNewPostsSubscription({
    variables: {
      slug,
    },
    shouldResubscribe: true,
    onSubscriptionData: ({ subscriptionData, client }) => {
      const post = subscriptionData?.data?.forumActivity?.post;
      const topic = subscriptionData?.data?.forumActivity?.topic;
      const forum = subscriptionData?.data?.forumActivity?.forum;
      if (!post || !topic || !forum) {
        throw new Error("Malformed forumActivity subscription event");
      }
      if (subscriptionData?.data?.forumActivity?.post) {
        client.cache.updateQuery<TopicDetailQuery>(
          {
            query: TopicDetailDocument,
            variables: {
              id: topic.id,
            },
          },
          (data) => {
            if (data?.topic?.postsConnection) {
              return {
                ...data,
                topic: {
                  ...data?.topic,
                  ...topic,
                  postsConnection: {
                    ...data.topic.postsConnection,
                    nodes: [
                      ...data.topic.postsConnection.nodes.filter(
                        (n) => n.id !== post.id
                      ),
                      post,
                    ],
                  },
                  forum: {
                    ...data.topic.forum,
                    ...forum,
                  },
                },
              };
            }
          }
        );
      }
      client.refetchQueries({
        include: [TopicListDocument, ForumsDocument],
      });
      // refetch();
    },
  });

  if (!data && loading && !hidden) {
    return (
      <div className="p-8 space-y-3">
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

  if (data?.projectBySlug?.forums?.length === 0 && !hidden) {
    return (
      <Warning level="info">
        <Trans ns="forums">
          No forums have been configured for this project.
        </Trans>
      </Warning>
    );
  }

  return (
    <div className={hidden ? "hidden" : "flex flex-col overflow-hidden w-full"}>
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
              <h2 className="font-semibold mb-4">
                <Trans ns="homepage">Latest Discussions</Trans>
              </h2>
              <div className="space-y-4">
                {data?.projectBySlug?.latestPostsConnection.nodes.map((p) => (
                  <RecentPostItem key={p.id} post={p} />
                ))}
              </div>
            </div>
          )}
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
