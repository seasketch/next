import { GLLegendRGBRasterSymbol } from "./LegendDataModel";

export default function RGBRasterSymbol({
  data,
}: {
  data: GLLegendRGBRasterSymbol;
}) {
  if (
    Array.isArray(data.representativeColors) &&
    data.representativeColors.length >= 4
  ) {
    const breaks = Math.sqrt(data.representativeColors.length);
    return (
      <div className="w-4 h-4">
        {data.representativeColors.map((color, i) => (
          <div
            key={i}
            className={`float-left ${i % breaks === 0 ? "clear-both" : ""}`}
            style={{
              width: `${100 / breaks}%`,
              height: `${100 / breaks}%`,
              backgroundColor: `rgb(${color.join(",")})`,
            }}
          ></div>
        ))}
      </div>
    );
  } else {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          opacity=".25"
          d="M0 0H3V3H0V0ZM6 3H3V6H0V9H3V12H0V15H3V12H6V15H9V12H12V15H15V12H12V9H15V6H12V3H15V0H12V3H9V0H6V3ZM6 6V3H9V6H6ZM6 9H3V6H6V9ZM9 9V6H12V9H9ZM9 9H6V12H9V9Z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        ></path>
      </svg>
    );
  }
}
