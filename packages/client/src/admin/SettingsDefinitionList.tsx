import { Children, ReactNode } from "react";

export function SettingsDefinitionList({
  children,
}: {
  children: React.ReactNode;
}) {
  const childArray = Children.toArray(children);
  return (
    <dl className="sm:divide-y sm:divide-gray-200 zebra-stripe-child-div">
      {childArray.map((child, i) => {
        return (
          <div
            key={i}
            className={
              typeof child === "object" &&
              "type" in child &&
              // @ts-ignore
              child.type.name === "SettingsDLListItem"
                ? `px-2`
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
  alignCenter,
}: {
  term: string | ReactNode;
  description: string | ReactNode;
  truncate?: boolean;
  alignCenter?: boolean;
}) {
  if (alignCenter && truncate) {
    console.warn(
      "SettingsDLListItem: alignCenter and truncate are incompatible"
    );
  }
  return (
    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="flex items-center text-sm font-medium text-gray-500">
        {term}
      </dt>
      <dd
        className={`${
          alignCenter ? "flex items-center" : ""
        } mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 ${
          truncate ? "truncate" : ""
        }`}
      >
        {description}
      </dd>
    </div>
  );
}
