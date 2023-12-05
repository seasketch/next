import { Children, ReactNode } from "react";

export function SettingsDefinitionList({
  children,
}: {
  children: React.ReactNode;
}) {
  const childArray = Children.toArray(children);
  return (
    <dl className="sm:divide-y sm:divide-gray-200">
      {childArray.map((child, i) => {
        return (
          <div
            key={i}
            className={
              typeof child === "object" &&
              "type" in child &&
              // @ts-ignore
              child.type.name === "SettingsDLListItem"
                ? `py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2`
                : "px-2"
            }
          >
            {child}
          </div>
        );
      })}
    </dl>
  );
}

export function SettingsDLListItem({
  term,
  description,
  truncate,
}: {
  term: string | ReactNode;
  description: string | ReactNode;
  truncate?: boolean;
}) {
  return (
    <>
      <dt className="text-sm font-medium text-gray-500">{term}</dt>
      <dd
        className={`mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 ${
          truncate ? "truncate" : ""
        }`}
      >
        {description}
      </dd>
    </>
  );
}
