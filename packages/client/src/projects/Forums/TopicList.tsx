import {
  ParticipationStatus,
  useTopicListQuery,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import Skeleton from "../../components/Skeleton";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import TopicListItem from "./TopicListItem";
import JoinProjectPrompt from "../../auth/JoinProjectPrompt";
import SignInPrompt from "./SignInPrompt";
import { useAuth0 } from "@auth0/auth0-react";
import LoginOrJoinPrompt from "./LoginOrJoinPrompt";

const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function TopicList({ forumId }: { forumId: number }) {
  const onError = useGlobalErrorHandler();
  const { user } = useAuth0();
  const { data, loading } = useTopicListQuery({
    variables: {
      forumId,
    },
    pollInterval: 60000,
    onError,
    fetchPolicy: "cache-and-network",
  });

  if (loading && !data) {
    return (
      <div className="p-4 mt-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3 mt-6" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-1/3 mt-6" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }

  if (data && data?.forum?.topicsConnection.nodes.length === 0) {
    return (
      <div className="p-4">
        <div className="mx-auto p-4 border-4 border-dashed text-sm rounded">
          {data?.forum?.canPost ? (
            <Trans>
              This forum has no discussion topics yet. Be the first to create
              one!
            </Trans>
          ) : (
            <Trans>This forum has no discussion topics yet.</Trans>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 p-4">
        {data?.forum?.topicsConnection.nodes.map((topic) => (
          <TopicListItem key={topic.id} topic={topic} />
        ))}
      </div>
      <LoginOrJoinPrompt
        className="pt-8 p-4"
        canPost={Boolean(
          data?.forum?.canPost &&
            data?.forum?.project?.sessionParticipationStatus ===
              ParticipationStatus.ParticipantSharedProfile
        )}
      />
    </>
  );
}
