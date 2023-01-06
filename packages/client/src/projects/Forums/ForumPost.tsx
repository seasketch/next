import { useEffect, useRef, MouseEvent } from "react";
import {
  AuthorProfileFragment,
  ForumPostFragment,
} from "../../generated/graphql";
import { DOMSerializer, Node } from "prosemirror-model";
import { forumPosts } from "../../editor/config";
import InlineAuthorDetails from "./InlineAuthorDetails";
import { motion } from "framer-motion";

const renderer = (doc: any) => {
  return DOMSerializer.fromSchema(forumPosts.schema).serializeFragment(
    Node.fromJSON(forumPosts.schema, doc).content
  );
};

export default function ForumPost({
  post,
  isFirstPostInTopic,
  onProfileClick,
}: {
  post: ForumPostFragment;
  isFirstPostInTopic: boolean;
  onProfileClick?: (
    e: MouseEvent<HTMLElement>,
    profile: AuthorProfileFragment
  ) => void;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0.5,
        scale: 0,
        backgroundColor: "rgb(100, 100, 255)",
      }}
      animate={{ opacity: 1, scale: 1, backgroundColor: "rgb(255, 255, 255)" }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.25,
      }}
      className="p-4 pt-3 border bg-white"
      id={`post-${post.id}`}
    >
      <div className="mb-3 text-gray-600">
        {post.authorProfile && (
          <InlineAuthorDetails
            onProfileClick={onProfileClick}
            profile={post.authorProfile}
            dateString={post.createdAt}
            firstPostInTopic={isFirstPostInTopic}
          />
        )}
      </div>
      <div
        className="prosemirror-body forum-post"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    </motion.div>
  );
}
