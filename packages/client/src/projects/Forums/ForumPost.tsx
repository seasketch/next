import { useEffect, MouseEvent, useState } from "react";
import {
  AuthorProfileFragment,
  ForumPostFragment,
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import InlineAuthorDetails from "./InlineAuthorDetails";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import ForumTreeView from "./ForumTreeView";

type SketchPortal = {
  items: (SketchTocDetailsFragment | SketchFolderDetailsFragment)[];
  key: string;
  ref: HTMLDivElement;
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
  const [bodyRef, setBodyRef] = useState<HTMLDivElement | null>(null);
  const [sketchPortals, setSketchPortals] = useState<SketchPortal[]>([]);

  useEffect(() => {
    if (bodyRef) {
      let portals: SketchPortal[] = [];
      for (const el of bodyRef.querySelectorAll(
        "[data-sketch-toc-attachment=true]"
      )) {
        const data = el.getAttribute("data-items");
        if (data) {
          const items = JSON.parse(data) as any[];
          if (items.length) {
            const parent = items.find(
              (i: any) => !i.collectionId && !i.forumId
            );
            if (parent) {
              portals.push({
                // eslint-disable-next-line i18next/no-literal-string
                key: `sketch-portal-${parent.id}`,
                items: items,
                ref: el as HTMLDivElement,
              });
              el.innerHTML = "";
            }
          }
        }
      }
      setSketchPortals(portals);
    } else {
      setSketchPortals([]);
    }
  }, [bodyRef]);

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
        ref={setBodyRef}
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
      {sketchPortals.map((portal) => {
        return createPortal(
          <ForumTreeView
            items={portal.items}
            timestamp={post.createdAt?.toString()}
          />,
          portal.ref,
          portal.key
        );
      })}
    </motion.div>
  );
}
