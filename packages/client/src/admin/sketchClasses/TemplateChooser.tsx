import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  SketchClassesDocument,
  SketchClassesQuery,
  SketchGeometryType,
  SketchingDetailsFragment,
  TemplateSketchClassFragment,
  useCreateSketchClassMutation,
  useTemplateSketchClassesQuery,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import {
  LineIcon,
  PointIcon,
  PolygonIcon,
} from "../../components/SketchGeometryTypeSelector";
import useProjectId from "../../useProjectId";
import { useState } from "react";
import Spinner from "../../components/Spinner";
import getSlug from "../../getSlug";

export default function TemplateChooser({
  onCreate,
}: {
  onCreate?: (sketchClass: SketchingDetailsFragment) => void;
}) {
  const { t } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();
  const projectId = useProjectId();
  const { data } = useTemplateSketchClassesQuery({
    onError,
  });
  const [mutate] = useCreateSketchClassMutation({
    onError,
    // refetchQueries: [SketchClassesDocument],
    update: (cache, { data }) => {
      const existingSketchClasses = cache.readQuery<SketchClassesQuery>({
        query: SketchClassesDocument,
        variables: {
          slug: getSlug(),
        },
      });
      if (
        data?.createSketchClassFromTemplate?.sketchClass &&
        existingSketchClasses?.projectBySlug?.sketchClasses
      ) {
        const newSketchClasses = [
          ...existingSketchClasses.projectBySlug.sketchClasses,
          data.createSketchClassFromTemplate.sketchClass,
        ];
        cache.writeQuery({
          query: SketchClassesDocument,
          variables: {
            slug: getSlug(),
          },
          data: {
            ...existingSketchClasses,
            projectBySlug: {
              ...existingSketchClasses.projectBySlug,
              sketchClasses: newSketchClasses,
            },
          },
        });
        if (onCreate) {
          onCreate(data.createSketchClassFromTemplate.sketchClass);
        }
      }
    },
  });

  const [clickedItem, setClickedItem] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-sm">
        {t(
          "Sketch Classes define the feature types your users will be able to draw and share. They define the geometry type, form attributes, and analytical reports associated with them. When used well they closely match regulatory or data collection goals."
        )}
      </p>
      <p className="text-sm mb-2">
        {t("Choose from the templates below to create a new Sketch Class.")}
      </p>
      <br />
      <div
        role="button"
        className="divide-y divide-gray-200 overflow-hidden rounded-lg bg-gray-100 shadow sm:grid sm:grid-cols-2 sm:gap-px sm:divide-y-0"
      >
        {(data?.templateSketchClasses || []).map((template, actionIdx) => (
          <TemplateItem
            key={template.id}
            disabled={clickedItem !== null}
            loading={clickedItem === template.id}
            onClick={async () => {
              setClickedItem(template.id);
              mutate({
                variables: {
                  projectId: projectId!,
                  templateId: template.id,
                },
              }).finally(() => {
                setClickedItem(null);
              });
            }}
            sketchClass={template}
            className={classNames(
              "relative",
              actionIdx === 0
                ? "rounded-tl-lg rounded-tr-lg sm:rounded-tr-none"
                : "",
              actionIdx === 1 ? "sm:rounded-tr-lg" : "",
              actionIdx === (data?.templateSketchClasses || []).length - 2
                ? "sm:rounded-bl-lg"
                : "",
              actionIdx === (data?.templateSketchClasses || []).length - 1
                ? "rounded-bl-lg rounded-br-lg sm:rounded-bl-none"
                : "",
              "relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500",
              clickedItem === null
                ? "hover:bg-opacity-80"
                : "bg-opacity-50 cursor-auto"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateItem({
  sketchClass,
  className,
  onClick,
  loading,
  disabled,
}: {
  sketchClass: TemplateSketchClassFragment;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      role={disabled ? "" : "button"}
      className={className}
      onClick={disabled ? undefined : onClick}
    >
      <SketchClassTemplateIcon
        geometryType={sketchClass.geometryType}
        name={sketchClass.name}
      />
      <div className="flex-1">
        <h3 className="font-semibold">{sketchClass.name}</h3>
        <p className="text-sm">{sketchClass.templateDescription}</p>
      </div>
      {loading && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-blue-300 bg-opacity-5">
          <Spinner large />
        </div>
      )}
    </div>
  );
}

export function SketchClassTemplateIcon({
  geometryType,
  name,
  color,
}: {
  geometryType: SketchGeometryType;
  name: string;
  color?: string;
}) {
  return (
    <div
      className={`p-2 w-12 h-12  items-center flex justify-center ${
        color ? color : "text-indigo-500"
      }`}
    >
      {(() => {
        if (name === "Marine Protected Area") {
          return <MPAIcon className="w-8 h-8" />;
        } else {
          switch (geometryType) {
            case SketchGeometryType.Point:
              return <PointIcon className="w-8 h-8" />;
            case SketchGeometryType.Polygon:
              return <PolygonIcon className="w-8 h-8" />;
            case SketchGeometryType.Linestring:
              return <LineIcon className="w-8 h-8" />;
            case SketchGeometryType.Collection:
              return <CollectionIcon className="w-8 h-8" />;
            default:
              return "";
          }
        }
      })()}
    </div>
  );
}

export function MPAIcon({ className }: { className?: string }) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      width="48"
      height="48"
      strokeWidth="1.5"
      stroke="currentColor"
      role="img"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M 19.86 19.86 C 25.908 13.813 23.14 3.487 14.88 1.272 C 11.046 0.246 6.954 1.342 4.147 4.147 M 19.86 19.86 C 13.813 25.908 3.487 23.14 1.272 14.88 C 0.246 11.046 1.342 6.954 4.147 4.147 M 19.86 19.86 L 4.147 4.147"
      />
      <ellipse
        style={{
          fill: "rgb(216, 216, 216)",
          strokeWidth: 0.5,
        }}
        stroke="currentColor"
        cx="14.605"
        cy="7.022"
        rx="0.753"
        ry="0.753"
      />
      <path
        style={{ strokeWidth: 1 }}
        stroke="currentColor"
        d="M 14.708 7.587 C 14.708 7.587 15.103 13.675 15.047 13.696 C 15.296 20.563 6.612 20.787 7.467 14.286 L 5.267 15.54"
      />
      <path
        style={{
          fill: "rgb(216, 216, 216)",
          strokeWidth: 1,
        }}
        stroke="currentColor"
        d="M 9.459 15.763 L 7.738 13.515"
      />
    </svg>
  );
}

export function CollectionIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

// @ts-ignore
function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}
