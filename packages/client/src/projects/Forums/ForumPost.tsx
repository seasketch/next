import { useEffect, useRef } from "react";
import { ForumPostFragment } from "../../generated/graphql";
import { DOMSerializer, Node } from "prosemirror-model";
import { forumPosts } from "../../editor/config";

const renderer = (doc: any) => {
  return DOMSerializer.fromSchema(forumPosts.schema).serializeFragment(
    Node.fromJSON(forumPosts.schema, doc).content
  );
};

export default function ForumPost({
  post,
}: {
  post: ForumPostFragment | { message: JSON };
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = ref.current;
    if (parent) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
      ref.current?.appendChild(renderer(post.message));
    }
  }, [ref, post.message]);
  return (
    <div className="bg-white p-4 border">
      <div className="prosemirror-body forum-post" ref={ref}></div>
    </div>
  );
}
