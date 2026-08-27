import SegmentControl from "../../components/SegmentControl";
import { ToastViewport } from "../../components/Toast";
import useSegmentState from "../../components/useSegmentState";
import BackgroundJobList from "./BackgroundJobList";
import BaseMapEditor from "./BasemapEditor";
import TableOfContentsEditor from "./TableOfContentsEditor";
import { memo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { parseTocItemIdFromSearch } from "./layerAdminDeepLink";

export default memo(function LayerAdminSidebar() {
  const location = useLocation();
  const pendingOverlayTabFromDeepLink = useRef(
    parseTocItemIdFromSearch(location.search) != null
  );
  const [selectedTab, setSelectedTab, segments] = useSegmentState({
    segments: ["Maps", "Overlay Layers"],
    defaultValue: "Maps",
    storageKey: "data-admin-tabs",
  });

  useEffect(() => {
    if (pendingOverlayTabFromDeepLink.current) {
      setSelectedTab("Overlay Layers");
      pendingOverlayTabFromDeepLink.current = false;
    }
  }, [setSelectedTab]);

  const visibleTab = pendingOverlayTabFromDeepLink.current
    ? "Overlay Layers"
    : selectedTab;
  // const [selectedTab, setSelectedTab] = useState<Segment>("Basemaps");
  const containerClassName = "flex flex-col h-full overflow-hidden";
  return (
    <div className="relative flex flex-col h-full bg-white">
      <header className="flex-shrink-0">
        <div className="max-w-sm m-auto mt-4">
          <SegmentControl
            segments={segments}
            value={visibleTab}
            onClick={setSelectedTab}
          />
        </div>
      </header>
      <div className="flex-2 overflow-y-auto">
        <div
          className={
            visibleTab === "Overlay Layers" ? containerClassName : "hidden"
          }
        >
          <TableOfContentsEditor />
        </div>
        <div className={visibleTab === "Maps" ? containerClassName : "hidden"}>
          <BaseMapEditor />
        </div>
      </div>
      <BackgroundJobList
        style={{ maxHeight: 400 }}
        className="flex-0 overflow-y-hidden"
      />
      <ToastViewport />
    </div>
  );
});
