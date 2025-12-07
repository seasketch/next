import INaturalistLegendContent from "./INaturalistLegendContent";

export type InaturalistLegendType = "grid" | "points" | "heatmap";

export function InaturalistLegendPanel({
  type,
}: {
  type: InaturalistLegendType;
}) {
  return (
    <div className="p-2 space-y-2">
      <INaturalistLegendContent type={type} />
    </div>
  );
}

export default InaturalistLegendPanel;

