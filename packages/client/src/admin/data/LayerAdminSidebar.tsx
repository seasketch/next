import SegmentControl from "../../components/SegmentControl";
import useSegmentState from "../../components/useSegmentState";
import BaseMapEditor from "./BasemapEditor";
import TableOfContentsEditor from "./TableOfContentsEditor";

export default function LayerAdminSidebar() {
  const [selectedTab, setSelectedTab, segments] = useSegmentState({
    segments: ["Maps", "Overlay Layers"],
    defaultValue: "Maps",
    storageKey: "data-admin-tabs",
  });
  // const [selectedTab, setSelectedTab] = useState<Segment>("Basemaps");
  return (
    <div className="flex flex-col max-h-full min-h-full bg-white">
      <header className="flex-shrink-0">
        <div className="max-w-sm m-auto mt-4">
          <SegmentControl
            segments={segments}
            value={selectedTab}
            onClick={setSelectedTab}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-scroll">
        <div className={selectedTab === "Overlay Layers" ? "block" : "hidden"}>
          <TableOfContentsEditor />
        </div>
        <div className={selectedTab === "Maps" ? "block" : "hidden"}>
          <BaseMapEditor />
        </div>
      </div>
    </div>
  );
}
