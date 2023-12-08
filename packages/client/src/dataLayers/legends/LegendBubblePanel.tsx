import { GLLegendBubblePanel } from "./LegendDataModel";

export default function LegendBubblePanel({
  panel,
  panelWidth,
}: {
  panel: GLLegendBubblePanel;
  panelWidth: number;
}) {
  const maxRadius = panel.stops[panel.stops.length - 1]?.radius || 5;
  const scaling = panelWidth < maxRadius ? panelWidth / maxRadius : 1;
  return (
    // eslint-disable-next-line i18next/no-literal-string
    <li
      key={panel.id}
      className="w-full relative"
      style={{
        height: maxRadius * scaling + 24,
      }}
    >
      {panel.label && (
        <h3 className="text-xs font-mono pl-2 my-1">{panel.label}</h3>
      )}
      {[...panel.stops].reverse().map((stop, i) => {
        return (
          <div
            key={panel.id + stop.value}
            className="w-full flex items-center justify-center absolute bottom-1.5"
          >
            <div
              className="rounded-full mb-1.5 shadow-sm"
              style={{
                // marginLeft: -stop.radius / 2,
                width: scaling * stop.radius,

                height: scaling * stop.radius,
                background: stop.fill,
                border:
                  stop.strokeWidth > 0
                    ? `${stop.strokeWidth}px solid ${stop.stroke}`
                    : undefined,
              }}
            ></div>
            <span
              className={`absolute top-0 ${
                i % 2 ? "left-0" : "right-0 text-right"
              } w-1/2 border-t border-black border-opacity-25 text-xs`}
            >
              <span
                className={
                  i === panel.stops.length - 1 ? "relative -top-4" : ""
                }
              >
                {stop.value.toLocaleString()}
              </span>
            </span>
          </div>
        );
      })}
    </li>
  );
}
