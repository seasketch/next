import { PlusIcon } from "@heroicons/react/outline";
import { LocationMarkerIcon } from "@heroicons/react/solid";
import { SketchGeometryType } from "../generated/graphql";

export default function SketchGeometryTypeSelector({
  value,
  onChange,
  simpleFeatures,
}: {
  value: SketchGeometryType;
  onChange?: (value: SketchGeometryType) => void;
  simpleFeatures?: boolean;
}) {
  let options = [
    SketchGeometryType.Point,
    SketchGeometryType.Linestring,
    SketchGeometryType.Polygon,
    SketchGeometryType.Collection,
  ];
  const labels = {
    [SketchGeometryType.Point]: "Point",
    [SketchGeometryType.Linestring]: "Line",
    [SketchGeometryType.Polygon]: "Polygon",
    [SketchGeometryType.Collection]: "Collection",
    [SketchGeometryType.ChooseFeature]: "Choose feature",
  };
  if (simpleFeatures) {
    options = options.slice(0, -1);
  }
  return (
    <div>
      {options.map((option, i) => {
        const checked = value === option;
        const IconComponent = Icons[option] || (() => null);
        return (
          <div
            className={`${i === 0 ? "rounded-tl-md rounded-tr-md" : ""} ${
              i === options.length - 1 ? "rounded-bl-md rounded-br-md" : ""
            } relative border px-4 py-4 flex cursor-pointer focus:outline-none items-center ${
              checked
                ? "bg-primary-500 bg-opacity-10 border-primary-500 border-opacity-50 z-10"
                : "border-gray-200"
            }`}
            key={option}
            onClick={() => {
              if (onChange) {
                onChange(option);
              }
            }}
          >
            <input
              className="text-primary-500 hidden"
              onChange={() => {
                if (onChange) {
                  onChange(option);
                }
              }}
              type="radio"
              id={option}
              name="geometryType"
              value={option}
              checked={checked}
            />
            <label
              className={`block w-full flex-1 cursor-pointer px-4 ${
                checked && "text-primary-600 font-semibold"
              }`}
              htmlFor={option.toString()}
            >
              {labels[option]}
            </label>
            <IconComponent
              className={`w-5 h-5 ${
                checked ? "text-primary-500" : "text-gray-400"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

export const Icons: { [type: string]: any } = {
  [SketchGeometryType.Point]: PointIcon,
  [SketchGeometryType.Linestring]: LineIcon,
  [SketchGeometryType.Polygon]: PolygonIcon,
  // [SketchGeometryType.Collection]: "Collection",
  // [SketchGeometryType.ChooseFeature]: "Choose feature",
};

export function PointIcon({
  className,
  multi,
}: {
  className?: string;
  multi?: boolean;
}) {
  if (multi) {
    return (
      <svg
        viewBox="0 0 24 24"
        height="48"
        width="48"
        focusable="false"
        role="img"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className}`}
      >
        <path d="M12 22s8.029-5.56 8-12c0-4.411-3.589-8-8-8S4 5.589 4 9.995C3.971 16.44 11.696 21.784 12 22zM8 9h3V6h2v3h3v2h-3v3h-2v-3H8V9z"></path>
      </svg>
    );
  } else {
    return <LocationMarkerIcon className={className} />;
  }
}

export function PolygonIcon({
  className,
  multi,
}: {
  className?: string;
  multi?: boolean;
}) {
  if (multi) {
    return (
      <div className={`${className} relative`}>
        <PlusIcon className="absolute text-white w-1/2 h-1/2 right-0 top-0.5" />
        <svg
          viewBox="0 0 24 24"
          height="48"
          width="48"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full`}
          style={{
            marginTop: 1,
            marginLeft: -1,
          }}
        >
          <path d="M18 15c-.183 0-.358.022-.532.054L8.946 6.532C8.978 6.359 9 6.182 9 6c0-1.654-1.346-3-3-3S3 4.346 3 6c0 1.302.839 2.401 2 2.815v6.369A2.997 2.997 0 0 0 3 18c0 1.654 1.346 3 3 3a2.993 2.993 0 0 0 2.815-2h6.369a2.994 2.994 0 0 0 2.815 2c1.654 0 3-1.346 3-3S19.654 15 18 15zm-11 .184V8.816c.329-.118.629-.291.894-.508l7.799 7.799a2.961 2.961 0 0 0-.508.894h-6.37A2.99 2.99 0 0 0 7 15.184zM6 5a1.001 1.001 0 1 1-1 1c0-.551.448-1 1-1zm0 14a1.001 1.001 0 0 1 0-2 1.001 1.001 0 0 1 0 2zm12 0a1.001 1.001 0 0 1 0-2 1.001 1.001 0 0 1 0 2z"></path>
        </svg>
      </div>
    );
  } else {
    return (
      <svg
        viewBox="0 0 24 24"
        height="48"
        width="48"
        focusable="false"
        role="img"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} relative`}
      >
        <path fill="none" d="M0 0h24v24H0z"></path>
        <path d="M7.83 20A3.001 3.001 0 114 16.17V7.83A3.001 3.001 0 117.83 4h8.34A3.001 3.001 0 1120 7.83v8.34A3.001 3.001 0 1116.17 20H7.83zm0-2h8.34A3.008 3.008 0 0118 16.17V7.83A3.008 3.008 0 0116.17 6H7.83A3.008 3.008 0 016 7.83v8.34A3.008 3.008 0 017.83 18zM5 6a1 1 0 100-2 1 1 0 000 2zm14 0a1 1 0 100-2 1 1 0 000 2zm0 14a1 1 0 100-2 1 1 0 000 2zM5 20a1 1 0 100-2 1 1 0 000 2z"></path>
      </svg>
    );
  }
}

export function LineIcon({
  multi,
  className,
}: {
  className?: string;
  multi?: boolean;
}) {
  if (multi) {
    return (
      <div className={`${className} relative`}>
        <PlusIcon className="absolute text-white w-1/2 h-1/2 left-0 top-0.5" />

        <svg
          viewBox="0 0 20 20"
          height="48"
          width="48"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={`transform rotate-45 scale-125 w-full h-full`}
          style={{
            marginLeft: 1,
            marginTop: 2,
          }}
        >
          <path d="M11 13.824V6.176A2.395 2.395 0 0012.4 4a2.4 2.4 0 10-4.8 0c0 .967.576 1.796 1.4 2.176v7.649A2.393 2.393 0 007.6 16a2.4 2.4 0 104.8 0c0-.967-.575-1.796-1.4-2.176zM10 2.615a1.384 1.384 0 110 2.768 1.384 1.384 0 010-2.768zm0 14.77a1.385 1.385 0 110-2.77 1.385 1.385 0 010 2.77z"></path>
        </svg>
      </div>
    );
  } else {
    return (
      <div className={`${className}`}>
        <svg
          viewBox="0 0 20 20"
          height="48"
          width="48"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={`transform rotate-45 scale-125 w-full h-full`}
        >
          <path d="M11 13.824V6.176A2.395 2.395 0 0012.4 4a2.4 2.4 0 10-4.8 0c0 .967.576 1.796 1.4 2.176v7.649A2.393 2.393 0 007.6 16a2.4 2.4 0 104.8 0c0-.967-.575-1.796-1.4-2.176zM10 2.615a1.384 1.384 0 110 2.768 1.384 1.384 0 010-2.768zm0 14.77a1.385 1.385 0 110-2.77 1.385 1.385 0 010 2.77z"></path>
        </svg>
      </div>
    );
  }
}
