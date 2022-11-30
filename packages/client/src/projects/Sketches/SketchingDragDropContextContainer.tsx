import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import SketchingTools from "./SketchingTools";

export default function SketchingDragDropContextContainer({
  hidden,
}: {
  hidden?: boolean;
}) {
  return (
    <DndProvider backend={HTML5Backend}>
      <SketchingTools hidden={hidden} />
    </DndProvider>
  );
}
