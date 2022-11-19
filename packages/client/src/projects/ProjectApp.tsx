import bytes from "bytes";
import React, {
  Suspense,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
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
import { OfflineStateContext } from "../offline/OfflineStateContext";
import OfflineToastNotification from "../offline/OfflineToastNotification";
import OfflineResponsesToastNotification from "../offline/OfflineResponsesToastNotification";
import JoinProjectPrompt from "../auth/JoinProjectPrompt";
import UserProfileModal from "./UserProfileModal";
const LazyOverlays = React.lazy(
  () => import(/* webpackChunkName: "Overlays" */ "./OverlayLayers")
);
const LazySketchingTools = React.lazy(
  () => import(/* webpackChunkName: "Sketching" */ "./Sketches/SketchingTools")
);
const LazyCacheSettingsPage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "CacheSettingsPage" */ "../auth/CacheSettingsPage"
    )
);

export default function ProjectApp() {
  const [mapContainerPortal, setMapContainerPortal] =
    useState<null | HTMLDivElement>(null);
  const mapContext = useMapContext({
    preferencesKey: "homepage",
    cacheSize: bytes("200mb"),
    containerPortal: mapContainerPortal,
  });

  const contextValue = useMemo(() => {
    return {
      ...mapContext,
      containerPortal: mapContainerPortal,
    };
  }, [mapContext, mapContainerPortal]);

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
    settings: t("Cache Settings"),
  };
  const { basemaps, tableOfContentsItems } = useMapData(mapContext);
  const { online } = useContext(OfflineStateContext);
  const dark = true;
  return (
    <div
      className="h-screen flex flex-col ml-14"
      style={{ width: "calc(100vw - 3.5rem)" }}
    >
      {/* <ProjectAppHeader /> */}
      <MapContext.Provider value={contextValue}>
        {/* <ProjectAppHeader /> */}
        <div className="flex flex-grow w-full">
          <MapboxMap className="ml-2" />
          <div
            className="absolute flex items-center justify-center w-screen h-full pointer-events-none"
            ref={setMapContainerPortal}
          ></div>
        </div>
        <MiniSidebar
          dark={dark}
          onExpand={() => {
            setExpandSidebar((prev) => !prev);
            history.replace(`/${slug}/app`);
          }}
        />
        <Route path={`/${slug}/profile`}>
          <UserProfileModal
            onRequestClose={() => history.push(`/${slug}/app`)}
          />
        </Route>
        <AnimatePresence initial={false}>
          <ProjectAppSidebar
            title={sidebarTitles[showSidebar?.params["sidebar"] || ""]}
            onClose={() => history.replace(`/${slug}/app`)}
            dark={dark}
            hidden={Boolean(!showSidebar)}
          >
            <Suspense
              fallback={
                <div className="flex mt-10 items-center justify-center self-center place-items-center justify-items-center">
                  Loading <Spinner />
                </div>
              }
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Route path={`/${slug}/app/maps`}>
                  <BasemapControl basemaps={basemaps} />
                </Route>
                <Route path={`/${slug}/app/overlays`}>
                  <LazyOverlays
                    items={tableOfContentsItems as TableOfContentsItem[]}
                  />
                </Route>
                <Route path={`/${slug}/app/forums`}>
                  <JoinProjectPrompt variant="forums" />
                </Route>
                <Route
                  children={(match) => (
                    <LazySketchingTools hidden={!Boolean(match.match)} />
                  )}
                  path={`/${slug}/app/sketches`}
                  // component={SketchingTools}
                />
                <Route path={`/${slug}/app/settings`}>
                  <LazyCacheSettingsPage />
                </Route>
              </motion.div>
            </Suspense>
          </ProjectAppSidebar>
        </AnimatePresence>
        <FullSidebar
          dark={dark}
          open={expandSidebar}
          onClose={() => {
            setExpandSidebar((prev) => false);
          }}
        />
        <OfflineToastNotification />
        <OfflineResponsesToastNotification />
      </MapContext.Provider>
    </div>
  );
}
