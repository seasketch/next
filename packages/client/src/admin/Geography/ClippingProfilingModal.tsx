import { useMemo } from "react";
import Modal from "../../components/Modal";
import { SpanJSONOutput } from "../../draw/preprocess";
import { StopwatchIcon } from "@radix-ui/react-icons";
import { Trans } from "react-i18next";
// Fix d3 imports
import { scaleLinear } from "d3-scale";
import { ticks as d3Ticks } from "d3-array";

const SIDEBAR_WIDTH = 160; // px, matches .w-40 min-w-40

function TimeScale({
  totalDuration,
  width,
  height,
  ticks,
  scale,
  formatTick,
}: {
  totalDuration: number;
  width: number;
  height: number;
  ticks: number[];
  scale: (val: number) => number;
  formatTick: (val: number) => string;
}) {
  return (
    <div
      className="relative rounded-t"
      style={{ width, height, background: "none" }}
    >
      {/* Tick values at the top */}
      {ticks.map((tick, i) => {
        const left = scale(tick);
        return (
          <div
            key={tick}
            className="absolute flex flex-col items-center"
            style={{
              left,
              top: 0,
              height: "100%",
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <div
              className="text-xs text-black mb-1 select-none"
              style={{
                whiteSpace: "nowrap",
                marginBottom: 2,
                marginTop: 2,
                fontWeight: 500,
                marginLeft: 2,
              }}
            >
              {formatTick(tick)} <Trans ns="admin:geography">ms</Trans>
            </div>
            <div className="flex-1 flex items-stretch">
              <div className="w-0 border-l-2 border-yellow-300 h-full" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpanRow({
  span,
  totalDuration,
  depth = 0,
}: {
  span: SpanJSONOutput;
  totalDuration: number;
  depth?: number;
}) {
  const duration = span.end - span.start;
  const left = (span.start / totalDuration) * 100;
  const width = Math.max(0.5, (duration / totalDuration) * 100);
  const paddingLeft = depth * 0.5 + 0.25;
  const bgColor = "rgba(234, 179, 8, 0.95)"; // yellow-500
  const metadata = span.metadata
    ? Object.entries(span.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    : "";
  // eslint-disable-next-line i18next/no-literal-string
  const title = `${span.id} (${duration}ms)${metadata ? ` - ${metadata}` : ""}`;

  return (
    <>
      <div className="flex items-center h-5" style={{ minHeight: 20 }}>
        <div
          className="w-40 min-w-40 overflow-hidden text-ellipsis whitespace-nowrap px-1 cursor-pointer hover:bg-yellow-200 text-xs"
          style={{ paddingLeft: `${paddingLeft}rem`, color: "black" }}
          title={span.id}
        >
          {span.id}
        </div>
        <div className="flex-grow relative h-4">
          <div
            className="absolute h-4 text-xs text-center leading-4 overflow-hidden whitespace-nowrap text-ellipsis hover:brightness-95 text-black"
            style={{
              width: `${width}%`,
              left: `${left}%`,
              backgroundColor: bgColor,
              border: "1px solid black",
            }}
            title={title}
          >
            {duration}
            {
              // eslint-disable-next-line i18next/no-literal-string
              <Trans ns="admin:geography">ms</Trans>
            }
          </div>
        </div>
      </div>
      {span.children &&
        span.children.length > 0 &&
        span.children.map((child) => (
          <SpanRow
            key={child.id}
            span={child}
            totalDuration={totalDuration}
            depth={depth + 1}
          />
        ))}
    </>
  );
}

export default function ClippingProfilingModal({
  data,
  onRequestClose,
}: {
  data: SpanJSONOutput;
  onRequestClose: () => void;
}) {
  const totalDuration = data ? data.end - data.start : 0;
  const timelineHeight = 38;
  const width = 600;
  const approxTickCount = Math.max(2, Math.floor(width / 120));
  const scale = useMemo(
    () =>
      scaleLinear()
        .domain([0, totalDuration])
        .range([0, width - SIDEBAR_WIDTH]),
    [totalDuration, width]
  );
  const ticks = useMemo(
    () => d3Ticks(0, totalDuration, approxTickCount),
    [totalDuration, approxTickCount]
  );
  const formatTick = useMemo(
    () => scale.tickFormat(approxTickCount),
    [scale, approxTickCount]
  );
  const stripeColors = ["rgba(253, 224, 71, 0.18)", "rgba(250, 204, 21, 0.25)"];

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <StopwatchIcon className="text-black" />
          <span className="text-base text-black">
            <Trans ns="admin:geography">Clipping Performance Profile</Trans>
          </span>
        </div>
      }
      onRequestClose={onRequestClose}
      className="bg-yellow-300 border-black border"
      panelClassName="bg-yellow-300"
    >
      <div className="p-2 bg-yellow-300 text-black">
        <div className="mb-2 text-sm">
          <Trans ns="admin:geography">
            This timeline shows the time spent in each step of the clipping
            process. Hover over bars for details.
          </Trans>
        </div>
        <div
          className="bg-yellow-300 border border-black rounded-lg overflow-hidden max-h-[45vh] overflow-y-auto mb-2"
          style={{ position: "relative", width }}
        >
          {/* Timeline */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <TimeScale
              totalDuration={totalDuration}
              width={width}
              height={timelineHeight}
              ticks={ticks}
              scale={(val: number) => scale(val) + SIDEBAR_WIDTH}
              formatTick={formatTick}
            />
          </div>
          {/* Bars area with stripes */}
          <div style={{ display: "flex", position: "relative", zIndex: 10 }}>
            {/* Sidebar (span names) */}
            {/* Bars area */}
            <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
              {/* Zebra stripes background */}
              <div
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 0, left: SIDEBAR_WIDTH }}
                aria-hidden="true"
              >
                {ticks.map((tick, i) => {
                  const left = scale(tick);
                  const nextTick =
                    i < ticks.length - 1
                      ? scale(ticks[i + 1])
                      : width - SIDEBAR_WIDTH;
                  const stripeWidth = nextTick - left;
                  return (
                    <div
                      key={tick}
                      className="absolute"
                      style={{
                        left,
                        top: "-20%",
                        width: stripeWidth,
                        height: "120%",
                        // background: stripeColors[i % 2],
                        // add a background gradient that fades in from the top
                        background: `linear-gradient(to top, ${
                          stripeColors[i % 2]
                        } 85%, rgba(0,0,0,0) 100%)`,
                      }}
                    />
                  );
                })}
              </div>
              {/* Bars */}
              <div style={{ position: "relative", zIndex: 1 }}>
                <SpanRow span={data} totalDuration={totalDuration} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
