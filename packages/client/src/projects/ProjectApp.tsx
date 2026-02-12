import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import bytes from "bytes";
import React, {
  Suspense,
  useState,
  useMemo,
  useCallback,
  useContext,
} from "react";
import { Route, useHistory, useParams, useRouteMatch } from "react-router-dom";
import MapboxMap from "../components/MapboxMap";
import {
  MapManagerContext,
  MapOverlayContext,
  LegendsContext,
  SketchLayerContext,
  useMapContext,
} from "../dataLayers/MapContextManager";
import { BasemapContext } from "../dataLayers/BasemapContext";
import MapUIProvider from "../dataLayers/MapUIContext";
import {
  BasemapDetailsFragment,
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
  TableOfContentsItem,
  useProjectMetadataQuery,
} from "../generated/graphql";
import Toolbar from "./Toolbar";
import { Trans, useTranslation } from "react-i18next";
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
  ShowCoordinates,
  ShowScaleBar,
} from "../draw/MapSettingsPopup";
import { MeasureControlContextProvider } from "../MeasureControl";
import ProjectMapLegend from "./ProjectMapLegend";
import { TableOfContentsMetadataModalProvider } from "../dataLayers/TableOfContentsMetadataModal";
import { DataDownloadModalProvider } from "../dataLayers/DataDownloadModal";
import AboutPage from "./AboutPage";
import getSlug from "../getSlug";

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

/**
 * Small component that reads MapContext to provide map settings actions.
 * Isolated so that map context state changes only re-render this subtree
 * rather than the entire ProjectApp.
 */
function MapSettingsActions() {
  const { manager } = useContext(MapManagerContext);
  return (
    <>
      <ResetToProjectBounds mapContextManager={manager} />
      <ShowScaleBar />
      <ShowCoordinates />
      <Measure />
    </>
  );
}

interface ProjectAppProps {
  setMapContainerPortal: React.Dispatch<
    React.SetStateAction<HTMLDivElement | null>
  >;
  showLegendByDefault: boolean;
  basemaps: BasemapDetailsFragment[];
  tableOfContentsItems: OverlayFragment[];
  dataLayers: DataLayerDetailsFragment[];
  dataSources: DataSourceDetailsFragment[];
}

const ProjectApp = React.memo(function ProjectApp({
  setMapContainerPortal,
  showLegendByDefault,
  basemaps,
  tableOfContentsItems,
  dataLayers,
  dataSources,
}: ProjectAppProps) {
  const history = useHistory();
  const { location } = history;
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
    about: t("About this Project"),
    accessibility: t("Accessibility"),
  };
  const onExpandSidebar = useCallback(() => {
    setExpandSidebar((prev) => !prev);
    history.replace(`/${slug}/app`);
  }, [setExpandSidebar, history, slug]);

  // Disabling until I can see some Divehi translations -cb 3/29/23
  // Might need to just enable this for forum content and attribute forms
  // const { selectedLang } = getSelectedLanguage(i18n);
  const dark = true;

  const mapSettingsActions = useMemo(() => <MapSettingsActions />, []);

  const onRequestSidebarClose = useCallback(() => {
    setExpandSidebar(false);
  }, [setExpandSidebar]);

  return (
    <>
      <Toolbar
        dark={dark}
        onExpand={onExpandSidebar}
        expanded={expandSidebar}
      />

      <Route path={`/${slug}/profile`}>
        <UserProfileModal onRequestClose={() => history.push(`/${slug}/app`)} />
      </Route>
      <AnimatePresence initial={false}>
        <ProjectAppSidebar
          title={sidebarTitles[showSidebar?.params["sidebar"] || ""]}
          onClose={() => history.replace(`/${slug}/app`)}
          dark={dark}
          hidden={
            Boolean(!showSidebar) || showSidebar?.params["sidebar"] === "embed"
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
              <Route path={`/${slug}/app/about`}>
                <AboutPage />
              </Route>
              <Route path={`/${slug}/app/maps`}>
                <BasemapControl basemaps={basemaps} />
              </Route>
              <Route path={`/${slug}/app/overlays`}>
                <LazyOverlays
                  layers={dataLayers || []}
                  sources={dataSources || []}
                  items={tableOfContentsItems as TableOfContentsItem[]}
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
                        match.match?.path && /new-post/.test(match.match.path)
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
                  <LazySketchingTools hidden={!Boolean(match.match)} />
                )}
                path={`/${slug}/app/sketches`}
              />
              <Route path={`/${slug}/app/settings`}>
                <LazyCacheSettingsPage />
              </Route>
              <Route path={`/${slug}/app/accessibility`}>
                <div className="space-y-2 mt-2">
                  <p className="text-sm">
                    <Trans ns="accessibility">
                      Our team is committed to making SeaSketch accessible to
                      all users, including those with disabilities. We strive to
                      follow the Web Content Accessibility Guidelines (WCAG) to
                      ensure a seamless experience, particularly around keyboard
                      navigation and overall usability. While we continually
                      work to improve accessibility, we welcome feedback from
                      our users. If you encounter any issues or have
                      suggestions, please contact us at{" "}
                      <a
                        className="text-primary-500"
                        href="mailto:accessibility@seasketch.org"
                      >
                        accessibility@seasketch.org
                      </a>
                      .
                    </Trans>
                  </p>
                  <h3 className="pt-5">
                    <Trans ns="accessibility">Recent Updates</Trans>
                  </h3>
                  <div>
                    <h4 className="text-sm font-bold text-gray-700">
                      {new Date("Jan 29 2025").toLocaleDateString()}
                    </h4>
                    <p className="text-sm">
                      <Trans ns="accessibility">
                        We conducted a comprehensive review of the SeaSketch
                        interface to improve accessibility. Users can now fully
                        navigate basemaps, overlay layers, and discussion forums
                        using only keyboard input. Additionally, we have
                        implemented numerous ARIA attributes to enhance
                        compatibility with screen readers and other assistive
                        technologies, ensuring a more inclusive experience for
                        all users.
                      </Trans>
                    </p>
                  </div>
                </div>
              </Route>
            </motion.div>
          </Suspense>
        </ProjectAppSidebar>
      </AnimatePresence>
      <div className="flex flex-grow w-full h-full">
        <ProjectMapLegend
          showByDefault={showLegendByDefault}
          toolbarExpanded={expandSidebar}
          sidebarOpen={Boolean(showSidebar)}
        />
        <MapboxMap
          className="ml-2"
          showNavigationControls
          navigationControlsLocation="top-right"
          onRequestSidebarClose={onRequestSidebarClose}
          mapSettingsPopupActions={mapSettingsActions}
        />
        <div
          className="absolute flex items-center justify-center h-full pointer-events-none"
          style={{ width: "calc(100vw - 3.5rem)" }}
          ref={setMapContainerPortal}
        ></div>
      </div>
      <OfflineToastNotification />
      <OfflineResponsesToastNotification />
    </>
  );
});

/**
 * Outer wrapper that owns map context state, data queries, and context
 * providers. The inner ProjectApp is memoized so that re-renders caused by
 * map context state changes (e.g. layer visibility, basemap updates) don't
 * cascade into the UI tree unnecessarily.
 */
export default function ProjectAppContext() {
  const [mapContainerPortal, setMapContainerPortal] =
    useState<null | HTMLDivElement>(null);

  const { data } = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
    skip: !getSlug(),
  });

  const {
    managerState,
    sketchLayerState,
    mapOverlayState,
    basemapState,
    legendsState,
  } = useMapContext({
    preferencesKey: "homepage",
    cacheSize: bytes("200mb"),
    containerPortal: mapContainerPortal,
    defaultShowScale: data?.project?.showScalebarByDefault || false,
  });

  const { basemaps, tableOfContentsItems, dataLayers, dataSources } =
    useMapData(managerState?.manager);

  return (
    <div
      className="h-screen overflow-hidden flex flex-col ml-14"
      style={{ width: "calc(100vw - 3.5rem)" }}
      // dir={selectedLang.rtl ? "rtl" : "ltr"}
    >
      <DndProvider backend={HTML5Backend}>
        {/* <ProjectAppHeader /> */}
        <MapManagerContext.Provider value={managerState}>
          <SketchLayerContext.Provider value={sketchLayerState}>
            <BasemapContext.Provider
              value={{
                ...basemapState,
                basemaps,
              }}
            >
              <MapOverlayContext.Provider
                value={{
                  ...mapOverlayState,
                  dataLayers,
                  dataSources,
                  tableOfContentsItems,
                }}
              >
                <MapUIProvider preferencesKey={`${getSlug()}-homepage`}>
                  <LegendsContext.Provider value={legendsState}>
                    <MeasureControlContextProvider>
                      <SketchUIStateContextProvider>
                        <DataDownloadModalProvider>
                          <TableOfContentsMetadataModalProvider>
                            <ProjectApp
                              setMapContainerPortal={setMapContainerPortal}
                              showLegendByDefault={
                                data?.project?.showLegendByDefault || false
                              }
                              basemaps={basemaps}
                              tableOfContentsItems={tableOfContentsItems}
                              dataLayers={dataLayers}
                              dataSources={dataSources}
                            />
                          </TableOfContentsMetadataModalProvider>
                        </DataDownloadModalProvider>
                      </SketchUIStateContextProvider>
                    </MeasureControlContextProvider>
                  </LegendsContext.Provider>
                </MapUIProvider>
              </MapOverlayContext.Provider>
            </BasemapContext.Provider>
          </SketchLayerContext.Provider>
        </MapManagerContext.Provider>
      </DndProvider>
    </div>
  );
}
