import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  ChangeLogsSinceLastPublishQuery,
  ResolvableLayerCommentCardFragment,
} from "../../generated/graphql";
import ResolvableLayerCommentThreadCard from "./resolvableLayerComments/ResolvableLayerCommentThreadCard";
import { buildCommentThreads } from "./resolvableLayerComments/buildCommentThreads";

type PublishProject = NonNullable<
  ChangeLogsSinceLastPublishQuery["projectBySlug"]
>;

export default function PublishUnresolvedCommentsPanel(props: {
  project?: PublishProject | null;
}) {
  const { t } = useTranslation("admin:data");
  const items = props.project?.draftTableOfContentsItems || [];

  const sections = useMemo(() => {
    const out: {
      itemId: number;
      title: string;
      threads: ReturnType<typeof buildCommentThreads>;
    }[] = [];
    for (const item of items) {
      const unresolvedCount = item.unresolvedLayerComments?.length ?? 0;
      if (!unresolvedCount || item.isFolder) {
        continue;
      }
      const nodes = (
        item.resolvableLayerCommentsConnection?.nodes?.filter(
          (n): n is ResolvableLayerCommentCardFragment => Boolean(n)
        ) ?? []
      );
      const threads = buildCommentThreads(nodes).filter(
        (th) => th.root.resolvedAt == null
      );
      if (threads.length === 0) {
        continue;
      }
      out.push({
        itemId: item.id,
        title: item.title,
        threads,
      });
    }
    return out;
  }, [items]);

  if (sections.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-gray-600">
        <Trans ns="admin:data">
          There are no unresolved layer comments. You can publish when ready.
        </Trans>
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-gray-600">
        <Trans ns="admin:data">
          Review open threads below. Publishing is still allowed — this list
          helps your team finish discussions before release.
        </Trans>
      </p>
      {sections.map((section) => (
        <section key={section.itemId}>
          <h3 className="text-sm font-semibold text-gray-900">
            {section.title || t("Untitled layer")}
          </h3>
          <div className="mt-3 space-y-4">
            {section.threads.map((thread) => (
              <ResolvableLayerCommentThreadCard
                key={thread.root.id}
                thread={thread}
                tableOfContentsItemId={section.itemId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
