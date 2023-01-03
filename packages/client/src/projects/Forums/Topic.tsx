import { useApolloClient } from "@apollo/client";
import { useMemo } from "react";
import Skeleton from "../../components/Skeleton";
import {
  ForumTopicFragment,
  ForumTopicFragmentDoc,
  useTopicDetailQuery,
} from "../../generated/graphql";
import ForumPost from "./ForumPost";

export default function Topic({ id }: { id: number }) {
  const { data } = useTopicDetailQuery({
    variables: {
      id,
    },
    returnPartialData: true,
  });

  const client = useApolloClient();
  const title = useMemo(() => {
    if (data?.topic) {
      return data.topic.title;
    } else {
      const topic = client.cache.readFragment({
        fragment: ForumTopicFragmentDoc,
        // eslint-disable-next-line i18next/no-literal-string
        id: `Topic:${id}`,
        fragmentName: "ForumTopic",
      }) as ForumTopicFragment;
      if (topic) {
        return topic.title;
      } else {
        return null;
      }
    }
  }, [data?.topic, client.cache, id]);

  return (
    <div className="">
      <div className="p-4 bg-gray-50 shadow">
        {title ? (
          <h3 className="font-semibold">{title}</h3>
        ) : (
          <Skeleton className="w-1/2 h-5" />
        )}
      </div>
      <div className="space-y-4">
        {data?.topic?.postsConnection.nodes.length ? (
          data.topic.postsConnection.nodes.map((post) => (
            <ForumPost post={post} />
          ))
        ) : (
          <div className="space-y-2 mt-2">
            <Skeleton className="w-full h-5" />
            <Skeleton className="w-full h-5" />
            <Skeleton className="w-full h-5" />
            <Skeleton className="w-3/4 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
