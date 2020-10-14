import React, { ReactNode } from "react";

type DefinitionListItem = [string | ReactNode, string | ReactNode];

export default function DefinitionList(props: { items: DefinitionListItem[] }) {
  return (
    <div className="px-4 py-5 sm:p-0">
      <dl>
        {props.items.map((item) => (
          <div
            key={item[0]!.toString()}
            className="sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-2"
          >
            <dt className="text-sm leading-5 font-medium text-gray-500">
              {item[0]}
            </dt>
            <dd className="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
              {item[1]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
