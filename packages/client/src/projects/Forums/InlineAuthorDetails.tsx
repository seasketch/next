import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { AuthorProfileFragment } from "../../generated/graphql";
import { nameForProfile } from "./TopicListItem";
import { MouseEvent, useCallback, useContext, useState } from "react";
import { ProjectAppSidebarContext } from "../ProjectAppSidebar";
import { Trans } from "react-i18next";
import { LinkIcon } from "@heroicons/react/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";
import { motion } from "framer-motion";

export default function InlineAuthorDetails({
  profile,
  dateString,
  firstPostInTopic,
  onProfileClick,
  link,
  isFocused,
}: {
  profile: AuthorProfileFragment;
  dateString?: string;
  firstPostInTopic: boolean;
  onProfileClick?: (
    e: MouseEvent<HTMLElement>,
    profile: AuthorProfileFragment
  ) => void;
  link?: string;
  isFocused?: boolean;
}) {
  const sidebarContext = useContext(ProjectAppSidebarContext);
  const date = dateString ? new Date(dateString) : null;

  const [linkCopied, setLinkCopied] = useState(false);

  const copyLink = useCallback(() => {
    if (link) {
      window.location.hash = "";
      copyTextToClipboard(link);
      setLinkCopied(true);
      setTimeout(() => {
        setLinkCopied(false);
      }, 2000);
    }
  }, [setLinkCopied, link]);

  const onClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (onProfileClick) {
        onProfileClick(e, profile);
      }
    },
    [onProfileClick, profile]
  );
  return (
    <div className={`flex items-center `}>
      <button onClick={onClick} className="w-6 h-6 flex items-center flex-none">
        <ProfilePhoto {...profile} canonicalEmail="" />
      </button>
      <motion.div
        animate={isFocused || linkCopied ? "focused" : "normal"}
        variants={{
          focused: {
            backgroundColor: "rgba(255, 251, 235, 1)",
            borderBottom: "2px solid rgba(253, 230, 138, 1)",
            marginBottom: "-0.125rem",
          },
          normal: {
            backgroundColor: "rgba(255, 251, 235, 0)",
            borderBottom: "2px solid rgba(253, 230, 138, 0)",
            marginBottom: "-0.125rem",
          },
        }}
        transition={{
          duration: 0.4,
        }}
        className={`text-sm ml-2  space-x-1 flex items-center`}
      >
        <button
          onClick={onClick}
          className="font-semibold truncate inline-block hover:underline"
          style={{
            maxWidth: sidebarContext.isSmall ? "11rem" : "13rem",
          }}
        >
          {nameForProfile(profile)}
        </button>
        {date && (
          <>
            <span className="inline-flex">
              {firstPostInTopic ? (
                <Trans ns="forums">posted on</Trans>
              ) : (
                <Trans ns="forums">replied on</Trans>
              )}
            </span>
            <span className="inline-flex" title={dateString}>
              {" " +
                (sidebarContext.isSmall
                  ? date.toLocaleDateString()
                  : date.toLocaleTimeString([], {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }))}
            </span>
          </>
        )}
      </motion.div>
      {link && (
        <Tooltip>
          <TooltipTrigger>
            <button className="ml-1.5" onClick={copyLink}>
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {linkCopied ? (
              <Trans ns="homepage">Link Copied!</Trans>
            ) : (
              <Trans ns="homepage">Copy Link</Trans>
            )}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// https://stackoverflow.com/a/6055620
function fallbackCopyTextToClipboard(text: string) {
  var textArea = document.createElement("textarea");
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand("copy");
    var msg = successful ? "successful" : "unsuccessful";
  } catch (err) {
    console.error("Fallback: Oops, unable to copy", err);
  }

  document.body.removeChild(textArea);
}
export function copyTextToClipboard(text: string) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(
    function () {},
    function (err) {
      console.error("Async: Could not copy text: ", err);
    }
  );
}
