import JoinProjectPrompt from "../../auth/JoinProjectPrompt";
import { Trans as I18n, useTranslation } from "react-i18next";
import { useForumsQuery } from "../../generated/graphql";
import getSlug from "../../getSlug";
import ForumListItem from "./ForumListItem";
import Skeleton from "../../components/Skeleton";
import { useEffect, useState } from "react";
import ForumBreadcrumbs from "./ForumBreadcrumbs";
import TopicList from "./TopicList";
const Trans = (props: any) => <I18n ns="forums" {...props} />;

export type ForumBreadcrumb = { name: string; id: number };

export interface ForumBreadcrumbState {
  forum?: ForumBreadcrumb;
  topic?: ForumBreadcrumb;
}

export default function Forums({
  hidden,
  forumId,
}: {
  hidden?: boolean;
  forumId?: number;
}) {
  const slug = getSlug();
  const [breadcrumbState, setBreadcrumbState] =
    useState<null | ForumBreadcrumbState>(null);

  const { data, loading } = useForumsQuery({
    variables: {
      slug,
    },
  });

  useEffect(() => {
    if (data) {
      if (forumId) {
        const forum = (data?.projectBySlug?.forums || []).find(
          (f) => f.id === forumId
        );
        if (forum) {
          setBreadcrumbState((prev) => ({
            ...prev,
            forum: {
              name: forum.name,
              id: forumId,
            },
          }));
        }
      } else {
        setBreadcrumbState((prev) => ({
          ...prev,
          forum: undefined,
        }));
      }
    }
  }, [forumId, data?.projectBySlug?.forums, data]);

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
      {breadcrumbState?.forum && <ForumBreadcrumbs state={breadcrumbState} />}
      {!forumId && !breadcrumbState?.forum && (
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
      {forumId && breadcrumbState?.forum && !breadcrumbState.topic && (
        <TopicList forumId={forumId} />
      )}
    </div>
  );
}
