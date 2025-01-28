import { useApolloClient } from "@apollo/client";
import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Skeleton from "../../components/Skeleton";
import {
  AuthorProfileFragment,
  ForumTopicFragment,
  ForumTopicFragmentDoc,
  ParticipationStatus,
  useTopicDetailQuery,
} from "../../generated/graphql";
import ForumPost from "./ForumPost";
import ReplyForm from "./ReplyForm";
import { AnimatePresence } from "framer-motion";
import LoginOrJoinPrompt from "./LoginOrJoinPrompt";
import { createPortal } from "react-dom";
import { usePopper } from "react-popper";
import AuthorProfilePopupContents from "./AuthorProfilePopupContents";
import { useHistory } from "react-router-dom";

export default function Topic({ id }: { id: number }) {
  const { data } = useTopicDetailQuery({
    variables: {
      id,
    },
    returnPartialData: true,
    fetchPolicy: "cache-and-network",
    pollInterval: 40000,
  });

  const history = useHistory();
  const scrollable = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      data?.topic?.postsConnection?.nodes?.length &&
      scrollable.current &&
      history?.location?.hash?.length &&
      /#post-\d+$/.test(history.location.hash)
    ) {
      const postId = history.location.hash;
      const post = scrollable.current.querySelector(postId);
      if (post) {
        post.scrollIntoView();
      }
    }
  }, [
    history?.location?.hash,
    scrollable,
    data?.topic?.postsConnection?.nodes,
  ]);

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

  const accessibleSketchIds = useMemo(() => {
    const ids: number[] = [];
    const posts = data?.topic?.postsConnection.nodes || [];
    for (const post of posts) {
      ids.push(...((post.sketchIds as number[]) || []));
    }
    return ids;
  }, [data?.topic?.postsConnection]);

  const lastPostID = useMemo(() => {
    if (data?.topic?.postsConnection?.nodes) {
      const nodes = data.topic.postsConnection.nodes;
      return nodes[nodes.length - 1].id;
    } else {
      return null;
    }
  }, [data?.topic?.postsConnection?.nodes]);

  const [authorProfile, setAuthorProfile] =
    useState<AuthorProfileFragment | null>(null);

  const [referenceElement, setReferenceElement] = useState<any | null>(null);
  const [popperElement, setPopperElement] = useState<any | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "right-start",
  });

  const onProfileClick = useCallback(
    (e: MouseEvent<HTMLElement>, profile: AuthorProfileFragment) => {
      setAuthorProfile(profile);
      setReferenceElement(e.target);
    },
    []
  );

  useEffect(() => {
    if (authorProfile) {
      // Listen for escape key to close
      const handler = (e: any) => {
        if (e.key === "Escape") {
          setAuthorProfile(null);
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [authorProfile]);

  return (
    <div className="max-h-full flex flex-col overflow-hidden flex-1">
      {authorProfile &&
        createPortal(
          <div
            ref={setPopperElement}
            className="bg-white max-w-sm shadow-xl border border-black border-opacity-20 rounded z-50  p-2 text-sm"
            {...attributes.popper}
            style={{ ...styles.popper, zIndex: 99999999 }}
          >
            <AuthorProfilePopupContents
              onClose={() => {
                setAuthorProfile(null);
                if (referenceElement) {
                  referenceElement.focus();
                }
              }}
              profile={authorProfile}
            />
          </div>,
          document.body
        )}
      {authorProfile &&
        createPortal(
          <div
            onClick={() => setAuthorProfile(null)}
            className="w-screen h-screen absolute top-0 left-0 bg-black opacity-5 z-10"
          >
            &nbsp;
          </div>,
          document.body
        )}
      <div className="p-4 bg-gray-50 shadow z-10">
        {title ? (
          <h3 className="font-semibold">{title}</h3>
        ) : (
          <Skeleton className="w-1/2 h-5" />
        )}
      </div>
      <div ref={scrollable} className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {data?.topic?.postsConnection?.nodes?.length ? (
            <AnimatePresence initial={false}>
              {data.topic.postsConnection.nodes.map((post, i) => (
                <ForumPost
                  key={post.id}
                  isFirstPostInTopic={i === 0}
                  post={post}
                  onProfileClick={onProfileClick}
                  forumId={data?.topic?.forumId || 0}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="space-y-2 mt-2">
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-3/4 h-5" />
            </div>
          )}
        </div>
        {data?.me?.profile &&
          data.topic?.forum?.canPost &&
          data.topic.forum.project?.sessionParticipationStatus ===
            ParticipationStatus.ParticipantSharedProfile && (
            <ReplyForm
              accessibleSketchIds={accessibleSketchIds}
              key={`reply-to-${lastPostID}`}
              profile={data.me.profile}
              topicId={data.topic.id}
              onReply={() => {
                setTimeout(() => {
                  if (scrollable.current) {
                    scrollable.current.scrollTop = 99999999999999;
                  }
                }, 16);
              }}
            />
          )}
        <LoginOrJoinPrompt className="p-4 mb-8" />
      </div>
    </div>
  );
}
