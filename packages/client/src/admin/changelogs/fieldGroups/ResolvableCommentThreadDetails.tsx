import Spinner from "../../../components/Spinner";
import {
  GetLayerItemQuery,
  ResolvableLayerCommentCardFragment,
  useGetLayerItemQuery,
} from "../../../generated/graphql";
import ResolvableLayerCommentThreadCard from "../../data/resolvableLayerComments/ResolvableLayerCommentThreadCard";
import {
  buildCommentThreads,
  findThreadContainingComment,
} from "../../data/resolvableLayerComments/buildCommentThreads";
import { Trans } from "react-i18next";

function nodesFromItem(
  item: NonNullable<GetLayerItemQuery["tableOfContentsItem"]>
): ResolvableLayerCommentCardFragment[] {
  return (
    item.resolvableLayerCommentsConnection?.nodes?.filter(
      (n): n is ResolvableLayerCommentCardFragment => Boolean(n)
    ) ?? []
  );
}

export default function ResolvableCommentThreadDetails(props: {
  tableOfContentsItemId: number;
  commentId: number;
}) {
  const { data, loading, error } = useGetLayerItemQuery({
    variables: { id: props.tableOfContentsItemId },
    fetchPolicy: "cache-first",
  });

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  if (error || !data?.tableOfContentsItem) {
    return (
      <p className="max-w-sm p-2 text-sm text-gray-600">
        <Trans ns="admin:data">Could not load this comment thread.</Trans>
      </p>
    );
  }

  const threads = buildCommentThreads(nodesFromItem(data.tableOfContentsItem));
  const thread = findThreadContainingComment(threads, props.commentId);

  if (!thread) {
    return (
      <p className="max-w-sm p-2 text-sm text-gray-600">
        <Trans ns="admin:data">Thread not found.</Trans>
      </p>
    );
  }

  return (
    <div className="max-h-80 w-[min(26rem,calc(100vw-2rem))] overflow-y-auto p-1">
      <ResolvableLayerCommentThreadCard
        thread={thread}
        tableOfContentsItemId={props.tableOfContentsItemId}
        disabled
      />
    </div>
  );
}
