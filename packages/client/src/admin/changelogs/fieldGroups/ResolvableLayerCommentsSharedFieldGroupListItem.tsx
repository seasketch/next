import { ChatAlt2Icon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
} from "./FieldGroupListItemBase";
import ResolvableCommentThreadDetails from "./ResolvableCommentThreadDetails";

function commentIdFromMeta(meta: unknown): number | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const v = (meta as { comment_id?: unknown }).comment_id;
  return typeof v === "number" ? v : undefined;
}

export default function ResolvableLayerCommentsSharedFieldGroupListItem(
  props: FieldGroupListItemProps & {
    variant: "created" | "responded" | "resolved" | "reopened";
  }
) {
  const meta = props.changeLog.meta;
  const commentId = commentIdFromMeta(meta);
  const tocId = props.changeLog.entityId;

  const summary =
    props.variant === "created" ? (
      <Trans ns="admin:data">commented on a layer</Trans>
    ) : props.variant === "responded" ? (
      <Trans ns="admin:data">replied to a comment</Trans>
    ) : props.variant === "resolved" ? (
      <Trans ns="admin:data">resolved a comment</Trans>
    ) : (
      <Trans ns="admin:data">reopened a comment</Trans>
    );

  const showThread =
    typeof commentId === "number" && typeof tocId === "number";

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ChatAlt2Icon className="h-5 w-5" />}
      iconClassName="bg-amber-50 text-amber-700"
    >
      {showThread ? (
        <ChangeValue
          details={
            <ResolvableCommentThreadDetails
              tableOfContentsItemId={tocId}
              commentId={commentId}
            />
          }
        >
          {summary}
        </ChangeValue>
      ) : (
        <span>{summary}</span>
      )}
    </BaseFieldGroupListItem>
  );
}

export function ResolvableLayerCommentsCreatedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <ResolvableLayerCommentsSharedFieldGroupListItem
      {...props}
      variant="created"
    />
  );
}

export function ResolvableLayerCommentsRespondedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <ResolvableLayerCommentsSharedFieldGroupListItem
      {...props}
      variant="responded"
    />
  );
}

export function ResolvableLayerCommentsResolvedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <ResolvableLayerCommentsSharedFieldGroupListItem
      {...props}
      variant="resolved"
    />
  );
}

export function ResolvableLayerCommentsReopenedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <ResolvableLayerCommentsSharedFieldGroupListItem
      {...props}
      variant="reopened"
    />
  );
}
