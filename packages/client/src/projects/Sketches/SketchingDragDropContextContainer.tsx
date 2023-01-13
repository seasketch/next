import SketchingTools from "./SketchingTools";

export default function SketchingDragDropContextContainer({
  hidden,
  hideFullSidebar,
}: {
  hidden?: boolean;
  hideFullSidebar?: () => void;
}) {
  return <SketchingTools hidden={hidden} hideFullSidebar={hideFullSidebar} />;
}
