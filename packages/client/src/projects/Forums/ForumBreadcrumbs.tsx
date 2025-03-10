import { NavLink } from "react-router-dom";
import getSlug from "../../getSlug";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { PlusIcon } from "@heroicons/react/outline";
import {
  ParticipationStatus,
  useForumsQuery,
  useProjectMetadataQuery,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useMemo } from "react";
import { useTranslatedProps } from "../../components/TranslatedPropControl";
import clsx from "clsx";

export default function ForumBreadcrumbs({
  postingNewTopic,
  topicId,
  forumId,
}: {
  postingNewTopic?: boolean;
  topicId?: number | null;
  forumId?: number | null;
}) {
  const slug = getSlug();
  const { t } = useTranslation("forums");
  const onError = useGlobalErrorHandler();
  const getTranslatedProp = useTranslatedProps();

  const forumData = useForumsQuery({
    onError,
    variables: {
      slug: getSlug(),
    },
  });

  const projectData = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const forum = useMemo(() => {
    return (forumData.data?.projectBySlug?.forums || []).find(
      (f) => f.id === forumId
    );
  }, [forumData.data?.projectBySlug?.forums, forumId]);

  const canPost = useMemo(() => {
    return forum && forum.canPost;
  }, [forum]);

  return (
    <div className="flex w-full overflow-hidden bg-gray-100 p-2 px-4 h-10 text-sm font-semibold border-b shadow-sm flex-none items-center space-x-1">
      <div className="flex items-center w-full overflow-hidden">
        <BreadcrumbLink
          className="flex-none"
          to={`/${slug}/app/forums`}
          label={t("Forums")}
        />
        {forum && (
          <BreadcrumbLink
            showSlash
            to={`/${slug}/app/forums/${forumId}`}
            label={getTranslatedProp("name", forum)}
            className=""
          />
        )}
        {postingNewTopic && (
          <BreadcrumbLink
            showSlash
            className="flex-none"
            to={`/${slug}/app/forums/${forum?.id}/new-post`}
            label={t("New Topic")}
          />
        )}
      </div>
      {!topicId &&
        forumId &&
        canPost &&
        !postingNewTopic &&
        projectData?.data?.project?.sessionParticipationStatus ===
          ParticipationStatus.ParticipantSharedProfile && (
          <div className="flex-none text-right">
            <Button
              small
              href={`./${forumId}/new-post`}
              buttonProps={{
                tabIndex: -1,
              }}
              className="focus:ring-0 focus:outline-0 focus-visible:ring-2 focus-visible:rounded focus-visible:ring-blue-500"
              label={
                <>
                  {t("Post a topic")}
                  <PlusIcon className="w-4 h-4 ml-1" />
                </>
              }
            />
          </div>
        )}
    </div>
  );
}

function BreadcrumbLink({
  to,
  label,
  showSlash,
  className,
}: {
  to: string;
  label: string;
  showSlash?: boolean;
  className?: string;
}) {
  return (
    <>
      {showSlash && <span className="mx-1 text-gray-500">/</span>}
      <NavLink
        exact
        className={(active) =>
          clsx(
            active && "underline",
            "truncate",
            "focus:ring-0 focus:outline-0",
            "focus-visible:bg-blue-200 focus-visible:rounded focus-visible:px-1",
            className
          )
        }
        activeClassName={"cursor-default"}
        to={to}
      >
        {label}
      </NavLink>
    </>
  );
}
