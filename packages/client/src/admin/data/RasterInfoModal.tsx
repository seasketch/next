/* eslint-disable i18next/no-literal-string */
import { Bucket, Buckets, RasterInfo } from "@seasketch/geostats-types";
import Modal from "../../components/Modal";

interface RasterInfoModalProps {
  rasterInfo: RasterInfo;
  onRequestClose: () => void;
  className?: string;
}

/**
 * Displays information about the layers included in the geostats prop.
 * @param props
 * @returns
 */
export default function RasterInfoModal(props: RasterInfoModalProps) {
  return (
    <Modal
      className={props.className}
      onRequestClose={props.onRequestClose}
      open={true}
    >
      <div className="px-0 py-4 pb-1">
        <h2 className="text-lg font-medium leading-6 text-gray-900">Bands</h2>
        <div className="mt-4">
          {props.rasterInfo.bands.map((band) => (
            <div className="py-2">
              <h4>{band.name}</h4>
              <div className="flex items-center space-x-4 w-full">
                <div className="text-sm">
                  <p>Color Interpretation: {band.colorInterpretation}</p>
                  {/* <p>Base: {band.base}</p> */}
                  {/* <p>Count: {band.count}</p> */}
                  <p>
                    Minimum: {band.minimum}, Maximum: {band.maximum}
                    {band.noDataValue !== null && (
                      <span>, No Data Value: {band.noDataValue}</span>
                    )}
                  </p>
                  <p>Mean: {band.stats.mean.toPrecision(5)}</p>
                  <p>Standard Deviation: {band.stats.stdev.toPrecision(5)}</p>
                  {band.scale && <p>Scale: {band.scale}</p>}
                  {band.offset && <p>Offset: {band.offset}</p>}
                  {band.noDataValue !== null && (
                    <p>No Data Value: {band.noDataValue}</p>
                  )}
                </div>
                <RasterInfoHistogram
                  className="rounded bg-gray-50 ring-1 ring-gray-400 overflow-hidden shadow-sm"
                  count={band.count}
                  min={band.minimum}
                  max={band.maximum}
                  data={band.stats.histogram}
                  colorInterpretation={band.colorInterpretation}
                  width={250}
                  height={80}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function RasterInfoHistogram({
  data,
  min,
  max,
  count,
  colorInterpretation,
  width,
  height,
  className,
}: {
  data: Bucket[];
  min: number;
  max: number;
  count: number;
  colorInterpretation?: string | null;
  width: number;
  height: number;
  className?: string;
}) {
  const maxCount = Math.max(...data.map((d) => d[1] || 0));
  if (min === max) {
    return null;
  }
  let color = "bg-gray-500";
  switch (colorInterpretation?.toLowerCase()) {
    case "red":
      color = "bg-red-500";
      break;
    case "green":
      color = "bg-green-500";
      break;
    case "blue":
      color = "bg-blue-500";
      break;
    case "alpha":
      color = "bg-black";
      break;
    case "gray":
      color = "bg-gray-500";
      break;
  }
  return (
    <div className={`${className}`} style={{ width }}>
      {data.map((bucket, i) =>
        bucket[1] !== null ? (
          <div
            className={`${color}  -bottom-2 relative inline-block`}
            style={{
              height: (bucket[1] / maxCount) * height,
              width: width / 49,
            }}
          ></div>
        ) : null
      )}
    </div>
  );
}
