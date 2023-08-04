import SegmentControl from "../../components/SegmentControl";
import useSegmentState from "../../components/useSegmentState";
import DataUploadTaskList from "../uploads/DataUploadTaskList";
import BaseMapEditor from "./BasemapEditor";
import DropdownMenuDemo from "./GLStyleEditor/DropdownMenuDemo";
import TableOfContentsEditor from "./TableOfContentsEditor";

export default function LayerAdminSidebar() {
  const [selectedTab, setSelectedTab, segments] = useSegmentState({
    segments: ["Maps", "Overlay Layers"],
    defaultValue: "Maps",
    storageKey: "data-admin-tabs",
  });
  // const [selectedTab, setSelectedTab] = useState<Segment>("Basemaps");
  const containerClassName = "flex flex-col h-full overflow-hidden";
  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex-shrink-0">
        <div className="max-w-sm m-auto mt-4">
          <SegmentControl
            segments={segments}
            value={selectedTab}
            onClick={setSelectedTab}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div
          className={
            selectedTab === "Overlay Layers" ? containerClassName : "hidden"
          }
        >
          <TableOfContentsEditor />
        </div>
        <div className={selectedTab === "Maps" ? containerClassName : "hidden"}>
          <BaseMapEditor />
        </div>
      </div>
      <DataUploadTaskList className="flex-none max-h-96 xl:max-h-127 overflow-y-auto" />
    </div>
  );
}
