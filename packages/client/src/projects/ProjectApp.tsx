import bytes from "bytes";
import React, { Suspense, useState } from "react";
import { Route, useHistory, useParams, useRouteMatch } from "react-router-dom";
import MapboxMap from "../components/MapboxMap";
import { MapContext, useMapContext } from "../dataLayers/MapContextManager";
import { TableOfContentsItem } from "../generated/graphql";
import FullSidebar from "./FullSidebar";
import MiniSidebar from "./MiniSidebar";
import { useTranslation } from "react-i18next";
import ProjectAppSidebar from "./ProjectAppSidebar";
import { AnimatePresence, motion } from "framer-motion";
import BasemapControl from "../dataLayers/BasemapControl";
import useMapData from "../dataLayers/useMapData";
import Spinner from "../components/Spinner";
const LazyOverlays = React.lazy(
  () => import(/* webpackChunkName: "Overlays" */ "./OverlayLayers")
);

export default function ProjectApp() {
  const mapContext = useMapContext({
    preferencesKey: "homepage",
    cacheSize: bytes("200mb"),
  });
  const history = useHistory();
  const { slug } = useParams<{ slug: string }>();
  const showSidebar = useRouteMatch<{ sidebar: string }>(
    // eslint-disable-next-line
    `/${slug}/app/:sidebar`
  );
  const [expandSidebar, setExpandSidebar] = useState(!showSidebar);
  const { t } = useTranslation("sidebar");
  const sidebarTitles: { [key: string]: string } = {
    maps: t("Maps"),
    overlays: t("Overlay Layers"),
    sketches: t("Sketching Tools"),
    forums: t("Discussion Forums"),
  };
  const { basemaps, tableOfContentsItems } = useMapData(mapContext);
  const dark = true;
  return (
    <div
      className="h-screen flex flex-col ml-14"
      style={{ width: "calc(100vw - 3.5rem)" }}
    >
      {/* <ProjectAppHeader /> */}
      <MapContext.Provider value={mapContext}>
        {/* <ProjectAppHeader /> */}
        <div className="flex flex-grow w-full">
          <MapboxMap className="ml-2" />
        </div>
        <MiniSidebar
          dark={dark}
          onExpand={() => {
            setExpandSidebar((prev) => !prev);
            history.replace(`/${slug}/app`);
          }}
        />
        <AnimatePresence initial={false}>
          {showSidebar && (
            <ProjectAppSidebar
              title={sidebarTitles[showSidebar.params["sidebar"]]}
              onClose={() => history.replace(`/${slug}/app`)}
              dark={dark}
            >
              <Route path={`/${slug}/app/maps`}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <BasemapControl basemaps={basemaps} />
                </motion.div>
              </Route>
              <Route path={`/${slug}/app/overlays`}>
                <Suspense
                  fallback={
                    <p className="flex mt-10 items-center justify-center self-center place-items-center justify-items-center">
                      Loading <Spinner />
                    </p>
                  }
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LazyOverlays
                      items={tableOfContentsItems as TableOfContentsItem[]}
                    />
                  </motion.div>
                </Suspense>
              </Route>
            </ProjectAppSidebar>
          )}
        </AnimatePresence>
        <FullSidebar
          dark={dark}
          open={expandSidebar}
          onClose={() => {
            setExpandSidebar((prev) => false);
          }}
        />
      </MapContext.Provider>
    </div>
  );
}
