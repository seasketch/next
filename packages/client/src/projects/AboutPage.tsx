import { useTranslation } from "react-i18next";
import { useProjectMetadataQuery } from "../generated/graphql";
import getSlug from "../getSlug";
import "prosemirror-image-plugin/dist/styles/common.css";

export default function AboutPage() {
  const { data, loading } = useProjectMetadataQuery({
    variables: { slug: getSlug() },
  });
  const { i18n } = useTranslation();

  const english = data?.project?.aboutPageRenderedContent?.find(
    (c) => c && c.lang === "EN"
  );
  let content = english?.html || "";
  if (data?.project?.aboutPageRenderedContent) {
    const record = data.project.aboutPageRenderedContent.find(
      (c) => c && c.lang === i18n.language
    );
    if (record?.html) {
      content = record.html;
    }
  }

  if (loading) {
    return null;
  } else {
    return (
      <div className="metadata">
        <div
          className="ProseMirror ProseMirror-example-setup-style"
          dangerouslySetInnerHTML={{ __html: content }}
        ></div>
      </div>
    );
  }
}
