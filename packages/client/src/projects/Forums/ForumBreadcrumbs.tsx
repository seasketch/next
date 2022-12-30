import { HomeIcon } from "@heroicons/react/solid";
import { Link, NavLink } from "react-router-dom";
import getSlug from "../../getSlug";
import { ForumBreadcrumbState } from "./Forums";
import { Trans as I18n, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { PlusIcon } from "@heroicons/react/outline";
const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function ForumBreadcrumbs({
  state,
  postingNewTopic,
}: {
  state: ForumBreadcrumbState;
  postingNewTopic?: boolean;
}) {
  const slug = getSlug();
  const { t } = useTranslation("forums");
  return (
    <div className="flex w-full overflow-hidden bg-gray-100 p-2 px-4 text-sm font-semibold border-b shadow-sm h-10 items-center">
      <div className="flex items-center w-full overflow-hidden">
        <BreadcrumbLink
          className="flex-none"
          to={`/${slug}/app/forums`}
          label={t("Forums")}
        />
        {state.forum && (
          <BreadcrumbLink
            showSlash
            to={`/${slug}/app/forums/${state.forum.id}`}
            label={state.forum.name}
            className=""
          />
        )}
        {state.topic && state.forum && (
          <BreadcrumbLink
            showSlash
            to={`/${slug}/app/forums/${state.forum.id}/${state.topic.id}`}
            label={state.topic.name}
            className=""
          />
        )}
        {postingNewTopic && (
          <BreadcrumbLink
            showSlash
            className="flex-none"
            to={`/${slug}/app/forums/${state.forum?.id}/new-post`}
            label={t("New Topic")}
          />
        )}
      </div>
      {!state.topic && state.forum && state.canPost && !postingNewTopic && (
        <div className="flex-none text-right">
          <Button
            small
            href={`./${state.forum.id}/new-post`}
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
          `truncate ${active ? "" : "underline"} ${className}`
        }
        activeClassName={"cursor-default"}
        to={to}
      >
        {label}
      </NavLink>
    </>
  );
}
