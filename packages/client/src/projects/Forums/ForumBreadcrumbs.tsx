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
}: {
  state: ForumBreadcrumbState;
}) {
  const slug = getSlug();
  const { t } = useTranslation("forums");
  return (
    <div className="flex items-center w-full bg-gray-100 p-2 px-4 text-sm font-semibold border-b shadow-sm">
      <BreadcrumbLink to={`/${slug}/app/forums`} label={t("Forums")} />
      {state.forum && (
        <BreadcrumbLink
          showSlash
          to={`/${slug}/app/forums/${state.forum.id}`}
          label={state.forum.name}
          className="flex-1"
        />
      )}
      {state.topic && state.forum && (
        <BreadcrumbLink
          showSlash
          to={`/${slug}/app/forums/${state.forum.id}/${state.topic.id}`}
          label={state.topic.name}
          className="flex-2"
        />
      )}
      {!state.topic && state.forum && (
        <Button
          disabled
          small
          label={
            <>
              {t("Post a topic")}
              <PlusIcon className="w-4 h-4 ml-1" />
            </>
          }
        />
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
