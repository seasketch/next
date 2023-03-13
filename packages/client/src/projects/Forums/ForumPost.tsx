import { useEffect, MouseEvent, useState, useMemo, useContext } from "react";
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
import { LinkIcon } from "@heroicons/react/outline";
import getSlug from "../../getSlug";
import { useLocation } from "react-router-dom";
import { MapBookmarkAttachment } from "./PostContentEditor";
import BookmarksList from "./BookmarksList";
import { MapContext } from "../../dataLayers/MapContextManager";
import BookmarkItem from "./BookmarkItem";

type SketchPortal = {
  items: (SketchTocDetailsFragment | SketchFolderDetailsFragment)[];
  key: string;
  ref: HTMLDivElement;
};

export default function ForumPost({
  post,
  isFirstPostInTopic,
  onProfileClick,
  forumId,
}: {
  post: ForumPostFragment;
  forumId: number;
  isFirstPostInTopic: boolean;
  onProfileClick?: (
    e: MouseEvent<HTMLElement>,
    profile: AuthorProfileFragment
  ) => void;
}) {
  const [bodyRef, setBodyRef] = useState<HTMLDivElement | null>(null);
  const [sketchPortals, setSketchPortals] = useState<SketchPortal[]>([]);
  const [bookmarks, setBookmarks] = useState<MapBookmarkAttachment[]>([]);
  const location = useLocation();

  const isFocused = useMemo(() => {
    if (location?.hash && /#post-\d+/.test(location.hash)) {
      const postId = parseInt(location.hash.split("-")[1]);
      return postId === post.id;
    }
  }, [location?.hash, post.id]);

  const mapContext = useContext(MapContext);
  const [hoveredBookmarkId, setHoveredBookmarkId] = useState<
    string | null | undefined
  >(null);

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
      const attachments: MapBookmarkAttachment[] = (
        post.mapBookmarks || []
      ).map((b) => ({
        id: b.id,
        type: "MapBookmark",
        data: b,
      }));
      setBookmarks(attachments);
      const clickHandler = (e: Event) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            const attachment = attachments.find((b) => b.id === id);
            if (attachment && mapContext.manager) {
              mapContext.manager.showMapBookmark(attachment.data);
            }
          }
        }
      };
      bodyRef.addEventListener("click", clickHandler);
      const mouseoverListener = (e: Event) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            setHoveredBookmarkId(id);
          }
        }
      };
      bodyRef.addEventListener("mouseover", mouseoverListener);
      const mouseoutListener = (e: Event) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            setHoveredBookmarkId(null);
          }
        }
      };
      bodyRef.addEventListener("mouseout", mouseoutListener);
      return () => {
        bodyRef.removeEventListener("mouseover", mouseoverListener);
        bodyRef.removeEventListener("mouseout", mouseoutListener);
        bodyRef.removeEventListener("click", clickHandler);
      };
    } else {
      setSketchPortals([]);
      setBookmarks([]);
    }
  }, [bodyRef, mapContext?.manager]);

  useEffect(() => {
    if (bodyRef) {
      bodyRef
        .querySelectorAll(
          `[data-attachment-id]:not([data-attachment-id="${hoveredBookmarkId}"])`
        )
        .forEach((el) => {
          el.classList.remove("highlighted");
        });
      if (hoveredBookmarkId) {
        const el = bodyRef.querySelector(
          // eslint-disable-next-line i18next/no-literal-string
          `[data-attachment-id="${hoveredBookmarkId}"]`
        );
        if (el) {
          el.classList.add("highlighted");
        }
      }
    }
  }, [bodyRef, hoveredBookmarkId]);

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
      className="pt-3 border bg-white"
      id={`post-${post.id}`}
    >
      <div className="px-4 mb-3 text-gray-600">
        {post.authorProfile && (
          <InlineAuthorDetails
            isFocused={isFocused}
            onProfileClick={onProfileClick}
            profile={post.authorProfile}
            dateString={post.createdAt}
            firstPostInTopic={isFirstPostInTopic}
            link={`${
              window.location.origin
            }/${getSlug()}/app/forums/${forumId}/${post.topicId}#post-${
              post.id
            }`}
          />
        )}
      </div>
      <div
        className="px-4 pb-4 prosemirror-body forum-post"
        ref={setBodyRef}
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
      <div
        className={
          bookmarks.length > 0 ? ` border-t border-gray-50 -mt-1 p-2 pt-1` : ""
        }
      >
        {/* {bookmarks.map((attachment) => (
          <BookmarkItem
            key={attachment.data.id}
            bookmark={attachment.data}
            highlighted={Boolean(hoveredBookmarkId === attachment.data.id)}
            onHover={setHoveredBookmarkId}
            hasErrors={false}
          />
        ))} */}
        <div className="clear-both"></div>
      </div>
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
