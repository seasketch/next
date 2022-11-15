import { Trans } from "react-i18next";

/* eslint-disable i18next/no-literal-string */
export type GeostatsAttributeType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "mixed"
  | "object"
  | "array";

export interface GeostatsAttribute {
  attribute: string;
  count: number;
  type: GeostatsAttributeType;
  values: (string | number | boolean | null)[];
  min?: number;
  max?: number;
}

const numberFormatter = Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export default function GeostatsAttributesTable({
  attributes,
  className,
}: {
  attributes: GeostatsAttribute[];
  className?: string;
}) {
  return (
    <div className="w-full overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Type
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Values
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {attributes.map(({ type, min, max, values, attribute, count }) => (
            <tr key={attribute}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                {attribute}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                {type}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 overflow-ellipsis w-full">
                {type === "number" &&
                  min !== undefined &&
                  max !== undefined &&
                  `${numberFormatter.format(min)} - ${numberFormatter.format(
                    max
                  )}`}
                {min === undefined && max === undefined && (
                  <ValuesButton count={count} values={values} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValuesButton({ values, count }: { values: any[]; count: number }) {
  return (
    <button>
      <Trans i18nKey={"NumGeostatsValues"} count={count} ns="admin:data">
        {{ count }} values
      </Trans>
    </button>
  );
}
