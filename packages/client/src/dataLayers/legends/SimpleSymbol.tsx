import { VideoCameraIcon } from "@heroicons/react/solid";
import { GLLegendSymbol } from "./LegendDataModel";
import FillSymbol from "./FillSymbol";
import LineSymbol from "./LineSymbol";
import MarkerSymbol from "./MarkerSymbol";
import { Map } from "mapbox-gl";
import CircleSymbol from "./CircleSymbol";

export default function SimpleSymbol(props: {
  data: GLLegendSymbol;
  map?: Map;
}) {
  switch (props.data.type) {
    case "line":
      return <LineSymbol data={props.data} />;
    case "fill":
      return <FillSymbol data={props.data} map={props.map} />;
    case "marker":
      return props.map ? (
        <MarkerSymbol {...props.data} map={props.map} />
      ) : null;
    case "text":
      return (
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            color: props.data.color || "#000",
          }}
        >
          <path
            d="M3.68979 2.75C3.89667 2.74979 4.08232 2.87701 4.15679 3.07003L7.36662 11.39C7.46602 11.6477 7.33774 11.9371 7.0801 12.0365C6.82247 12.1359 6.53304 12.0076 6.43365 11.75L5.3825 9.02537H2.01133L0.966992 11.749C0.868128 12.0068 0.578964 12.1357 0.321126 12.0369C0.0632878 11.938 -0.0655864 11.6488 0.0332774 11.391L3.22344 3.07099C3.29751 2.87782 3.4829 2.75021 3.68979 2.75ZM3.69174 4.64284L5.05458 8.17537H2.33724L3.69174 4.64284ZM10.8989 5.20703C9.25818 5.20703 8.00915 6.68569 8.00915 8.60972C8.00915 10.6337 9.35818 12.0124 10.8989 12.0124C11.7214 12.0124 12.5744 11.6692 13.1543 11.0219V11.53C13.1543 11.7785 13.3557 11.98 13.6043 11.98C13.8528 11.98 14.0543 11.7785 14.0543 11.53V5.72C14.0543 5.47147 13.8528 5.27 13.6043 5.27C13.3557 5.27 13.1543 5.47147 13.1543 5.72V6.22317C12.6054 5.60095 11.7924 5.20703 10.8989 5.20703ZM13.1543 9.79823V7.30195C12.7639 6.58101 11.9414 6.05757 11.0868 6.05757C10.1088 6.05757 9.03503 6.96581 9.03503 8.60955C9.03503 10.1533 10.0088 11.1615 11.0868 11.1615C11.9701 11.1615 12.7719 10.4952 13.1543 9.79823Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          ></path>
        </svg>
      );
    case "raster":
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
    case "video":
      return <VideoCameraIcon className="w-4 h-4 text-gray-700" />;
    case "circle":
      return <CircleSymbol data={props.data} />;
    default:
      throw new Error(`Unknown symbol type: ${props.data}`);
  }
}
