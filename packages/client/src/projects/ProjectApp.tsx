import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import bytes from "bytes";
import React, { Suspense, useState, useMemo, createContext } from "react";
import { Route, useHistory, useParams, useRouteMatch } from "react-router-dom";
import MapboxMap from "../components/MapboxMap";
import {
  DigitizingLockState,
  MapContext,
  useMapContext,
} from "../dataLayers/MapContextManager";
import { TableOfContentsItem } from "../generated/graphql";
import FullSidebar from "./FullSidebar";
import MiniSidebar from "./MiniSidebar";
import { useTranslation } from "react-i18next";
import ProjectAppSidebar from "./ProjectAppSidebar";
import { AnimatePresence, motion } from "framer-motion";
import BasemapControl from "../dataLayers/BasemapControl";
import useMapData from "../dataLayers/useMapData";
import Spinner from "../components/Spinner";
import OfflineToastNotification from "../offline/OfflineToastNotification";
import OfflineResponsesToastNotification from "../offline/OfflineResponsesToastNotification";
import UserProfileModal from "./UserProfileModal";
import SketchUIStateContextProvider from "./Sketches/SketchUIStateContextProvider";
import {
  Measure,
  ResetToProjectBounds,
  ShowScaleBar,
} from "../draw/MapSettingsPopup";
import { MeasureControlContextProvider } from "../MeasureControl";
import ProjectMapLegend from "./ProjectMapLegend";
import { TableOfContentsMetadataModalProvider } from "../dataLayers/TableOfContentsMetadataModal";
import { DataDownloadModalProvider } from "../dataLayers/DataDownloadModal";

const LazyOverlays = React.lazy(
  () => import(/* webpackChunkName: "Overlays" */ "./OverlayLayers")
);
const LazySketchingTools = React.lazy(
  () => import(/* webpackChunkName: "Sketching" */ "./Sketches/SketchingTools")
);
const LazyForums = React.lazy(
  () => import(/* webpackChunkName: "Forums" */ "./Forums/Forums")
);
const LazyCacheSettingsPage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "CacheSettingsPage" */ "../auth/CacheSettingsPage"
    )
);

export const FullSidebarContext = createContext({
  open: false,
  setOpen: (open: boolean) => {},
});

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
  const { location } = history;
  const { slug } = useParams<{ slug: string }>();
  const showSidebar = useRouteMatch<{ sidebar: string }>(
    // eslint-disable-next-line
    `/${slug}/app/:sidebar`
  );

  const [expandSidebar, setExpandSidebar] = useState(!showSidebar);

  const { t, i18n } = useTranslation("sidebar");
  const sidebarTitles: { [key: string]: string } = {
    maps: t("Maps"),
    overlays: t("Overlay Layers"),
    sketches: t("Sketching Tools"),
    forums: t("Discussion Forums"),
    settings: t("Cache Settings"),
  };
  const { basemaps, tableOfContentsItems, dataLayers, dataSources } =
    useMapData(mapContext);
  // Disabling until I can see some Divehi translations -cb 3/29/23
  // Might need to just enable this for forum content and attribute forms
  // const { selectedLang } = getSelectedLanguage(i18n);
  const dark = true;
  return (
    <div
      className="h-screen flex flex-col ml-14"
      style={{ width: "calc(100vw - 3.5rem)" }}
      // dir={selectedLang.rtl ? "rtl" : "ltr"}
    >
      <FullSidebarContext.Provider
        value={{ open: expandSidebar, setOpen: setExpandSidebar }}
      >
        <DndProvider backend={HTML5Backend}>
          {/* <ProjectAppHeader /> */}
          <MapContext.Provider value={contextValue}>
            <MeasureControlContextProvider>
              <SketchUIStateContextProvider>
                <DataDownloadModalProvider>
                  <TableOfContentsMetadataModalProvider>
                    {/* <ProjectAppHeader /> */}
                    <div className="flex flex-grow w-full">
                      <ProjectMapLegend />
                      <MapboxMap
                        className="ml-2"
                        showNavigationControls={true}
                        navigationControlsLocation="top-right"
                        onRequestSidebarClose={() => setExpandSidebar(false)}
                        mapSettingsPopupActions={
                          <>
                            <ResetToProjectBounds
                              mapContextManager={mapContext.manager}
                            />
                            <ShowScaleBar mapContext={mapContext} />
                            <Measure />
                          </>
                        }
                      />
                      <div
                        className="absolute flex items-center justify-center h-full pointer-events-none"
                        style={{ width: "calc(100vw - 3.5rem)" }}
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
                        title={
                          sidebarTitles[showSidebar?.params["sidebar"] || ""]
                        }
                        onClose={() => history.replace(`/${slug}/app`)}
                        dark={dark}
                        hidden={
                          Boolean(!showSidebar) ||
                          showSidebar?.params["sidebar"] === "embed"
                        }
                        noPadding={
                          /sketches/.test(history.location.pathname) ||
                          /forums/.test(history.location.pathname) ||
                          /overlays/.test(history.location.pathname)
                        }
                      >
                        <Suspense
                          fallback={
                            <div className="flex mt-10 items-center justify-center self-center place-items-center justify-items-center">
                              <Spinner />
                            </div>
                          }
                        >
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`flex flex-col ${
                              /app\/forums\//.test(location.pathname)
                                ? "max-h-full overflow-hidden fffff"
                                : ""
                            }`}
                          >
                            <Route path={`/${slug}/app/maps`}>
                              <BasemapControl basemaps={basemaps} />
                            </Route>
                            <Route path={`/${slug}/app/overlays`}>
                              <LazyOverlays
                                layers={dataLayers || []}
                                sources={dataSources || []}
                                items={
                                  tableOfContentsItems as TableOfContentsItem[]
                                }
                              />
                            </Route>
                            <Route
                              children={(match) => {
                                return (
                                  <LazyForums
                                    hidden={!Boolean(match.match?.url)}
                                    forumId={
                                      match.match &&
                                      match.match.params &&
                                      "id" in match.match.params
                                        ? parseInt(match.match.params.id)
                                        : undefined
                                    }
                                    topicId={
                                      match.match &&
                                      match.match.params &&
                                      "topicId" in match.match.params
                                        ? parseInt(match.match.params.topicId)
                                        : undefined
                                    }
                                    postNewTopic={Boolean(
                                      match.match?.path &&
                                        /new-post/.test(match.match.path)
                                    )}
                                  />
                                );
                              }}
                              path={[
                                `/${slug}/app/forums/:id/new-post`,
                                `/${slug}/app/forums/:id/:topicId`,
                                `/${slug}/app/forums/:id`,
                                `/${slug}/app/forums`,
                              ]}
                              // component={SketchingTools}
                            />
                            <Route
                              children={(match) => (
                                <LazySketchingTools
                                  hidden={!Boolean(match.match)}
                                />
                              )}
                              path={`/${slug}/app/sketches`}
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
                  </TableOfContentsMetadataModalProvider>
                </DataDownloadModalProvider>
              </SketchUIStateContextProvider>
            </MeasureControlContextProvider>
          </MapContext.Provider>
        </DndProvider>
      </FullSidebarContext.Provider>
    </div>
  );
}
