import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { useParams, Link } from "react-router-dom";
import TextInput from "../components/TextInput";
import {
  useCurrentProjectMetadataQuery,
  useUpdateProjectSettingsMutation,
  useProjectAccessControlSettingsQuery,
  useUpdateProjectAccessControlSettingsMutation,
  ProjectAccessControlSetting,
  useProjectRegionQuery,
  useUpdateProjectRegionMutation,
} from "../generated/graphql";
import ProjectAutosaveInput from "./ProjectAutosaveInput";
import { useDropzone } from "react-dropzone";
import Switch from "../components/Switch";
import mapboxgl, { Map } from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import DrawRectangle from "mapbox-gl-draw-rectangle-mode";
import StaticMode from "@mapbox/mapbox-gl-draw-static-mode";
import bbox from "@turf/bbox";
import { useAuth0 } from "@auth0/auth0-react";
import Button from "../components/Button";
import { useTranslation, Trans } from "react-i18next";
import DataBucketSettings from "./data/DataBucketSettings";
import { AdminMobileHeaderContext } from "./AdminMobileHeaderContext";

export default function Settings() {
  const { data } = useCurrentProjectMetadataQuery();
  const { user } = useAuth0();
  const { setState: setHeaderState } = useContext(AdminMobileHeaderContext);
  useEffect(() => {
    setHeaderState({
      heading: "Settings",
    });
    return () => setHeaderState({});
  }, [setHeaderState]);
  return (
    <>
      <div className="pt-2 pb-6 md:py-6 max-h-full overflow-y-scroll">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8">
          {data && data.currentProject && (
            <BasicSettingsForm
              {...data.currentProject}
              url={`https://seasketch.org/${data.currentProject.slug}`}
            />
          )}
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8">
          <AccessControlSettings />
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8">
          <MapExtentSettings />
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8">
          <DataBucketSettings />
        </div>
        {user && user["https://seasketch.org/superuser"] ? (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8">
            <SuperUserSettings />
          </div>
        ) : null}
      </div>
    </>
  );
}

function BasicSettingsForm(props: {
  name: string;
  logo?: string;
  logoUrl?: string | null;
  logoLink?: string | null;
  description?: string | null;
  url: string;
  slug: string;
}) {
  const { t } = useTranslation(["admin"]);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  useEffect(() => {
    if (copiedToClipboard === true) {
      const timeout = setTimeout(() => {
        setCopiedToClipboard(false);
      }, 1000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [copiedToClipboard]);

  return (
    <div className="mt-5 md:mt-0 md:col-span-2">
      <form action="#" method="POST">
        <div className="shadow sm:rounded-md sm:overflow-hidden">
          <div className="px-4 py-5 bg-white sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-5">
              {t("Basic Settings")}
            </h3>

            <div className="md:max-w-xs">
              <ProjectAutosaveInput
                propName="name"
                label={t("Project Name")}
                value={props.name}
                slug={props.slug}
              />
            </div>
            <div className="md:max-w-xs mt-5">
              <ProjectAutosaveInput
                propName="description"
                label={t("Description")}
                placeholder={t("Brief description below the name")}
                value={props.description || ""}
                slug={props.slug}
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm leading-5 font-medium text-gray-700">
                {t("Logo")}
              </label>
              <p className="text-sm text-gray-500">
                <Trans ns="admin">
                  We recommend a square PNG logo with transparent background of
                  at least <code>128x128</code> pixels.
                </Trans>
              </p>
              <UploadLogoField logoUrl={props.logoUrl} slug={props.slug} />
            </div>
            <div className="md:max-w-xs mt-5">
              <ProjectAutosaveInput
                propName="logoLink"
                label={t("Logo Link URL")}
                value={props.logoLink || ""}
                slug={props.slug}
              />
            </div>
            <div className="md:max-w-xs mt-5">
              <TextInput
                name="url"
                label={t("Permanent Project URL")}
                value={props.url}
                disabled
                description={
                  <Trans ns="admin">
                    Contact{" "}
                    <a
                      className="underline"
                      target="_blank"
                      href="mailto:support@seasketch.org"
                    >
                      support
                    </a>{" "}
                    to discuss changing.
                  </Trans>
                }
                inputChildNode={
                  <>
                    <span
                      onClick={() => {
                        navigator.clipboard.writeText(props.url);
                        setCopiedToClipboard(true);
                      }}
                      className="absolute right-3 top-3 h-4 w-4 cursor-pointer text-gray-800 active:text-gray-500"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                    </span>
                    <span
                      className={`text-primary-500 p-1 px-4 rounded-full text-xs absolute w-auto right-0 top-0 -mt-7 -mr-4 duration-500 transition-opacity ${
                        copiedToClipboard ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {t("Copied URL")}
                    </span>
                  </>
                }
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function UploadLogoField(props: { slug: string; logoUrl?: string | null }) {
  const [mutate, mutationState] = useUpdateProjectSettingsMutation();
  const { t, i18n } = useTranslation(["admin"]);
  const onDrop = useCallback((acceptedFiles) => {
    // Do something with the files
    mutate({
      variables: {
        slug: props.slug,
        logoUrl: acceptedFiles[0],
      },
    }).catch((e) => {});
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <>
      <div
        {...getRootProps()}
        className={`-ml-1 mt-2 flex items-center ${
          isDragActive
            ? "border-dashed border-2 rounded-lg border-gray-300 -ml-1.5 mt-1.5 -mb-0.5"
            : ""
        }`}
      >
        <span className="h-16 w-16 overflow-hidden text-gray-400 flex items-center">
          {props.logoUrl ? (
            <img src={props.logoUrl} />
          ) : (
            <svg
              className="h-16 w-16"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="1 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </span>
        <span className="ml-2">
          <Button
            label={
              mutationState.loading ? t("Uploading") : t("Choose an Image")
            }
            loading={mutationState.loading}
            labelFor="logo-admin-input"
          />
          <input
            // {...getInputProps()}
            id="logo-admin-input"
            type="file"
            title="choose"
            accept="image/png, image/jpeg, image/gif"
            disabled={mutationState.loading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const target = e.target;
                mutate({
                  variables: {
                    slug: props.slug,
                    logoUrl: e.target.files[0],
                  },
                })
                  .catch((e) => {})
                  .then(() => {
                    target.value = "";
                  });
              }
            }}
            className="hidden py-2 px-1 text-sm leading-1 font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800 transition duration-150 ease-in-out"
          />

          {mutationState.error && (
            <p className="text-red-900">{mutationState.error.message}</p>
          )}
        </span>
      </div>
    </>
  );
}

function AccessControlSettings() {
  const { t, i18n } = useTranslation(["admin"]);
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useProjectAccessControlSettingsQuery({
    variables: {
      slug,
    },
  });
  const [
    mutate,
    mutationState,
  ] = useUpdateProjectAccessControlSettingsMutation();
  const [accessControl, setAccessControl] = useState<string | null>(null);
  const [isListedOn, setIsListedOn] = useState<boolean | null>(null);
  const updateAccessControl = (type: string) => {
    setAccessControl(type);
    update({ accessControl: type as ProjectAccessControlSetting });
  };
  const update = async (patch: {
    isListed?: boolean;
    accessControl?: ProjectAccessControlSetting;
  }) => {
    let variables = {
      slug,
      isListed:
        isListedOn === null ? data?.projectBySlug?.isListed : isListedOn,
      accessControl:
        accessControl === null
          ? data?.projectBySlug?.accessControl
          : (accessControl as ProjectAccessControlSetting),
      ...patch,
    };
    await mutate({
      variables,
    }).catch((e) => {});
  };

  const toggleIsListed = async () => {
    const isListed =
      isListedOn === null ? !data?.projectBySlug?.isListed : !isListedOn;
    const isPublic =
      accessControl === null
        ? data?.projectBySlug?.accessControl === "PUBLIC"
        : accessControl === "PUBLIC";
    if (isPublic) {
      if (isListed === false) {
        alert(t("You cannot unlist a public project."));
      }
    } else {
      setIsListedOn(isListed);
      await update({ isListed });
    }
  };
  if (!data?.projectBySlug) {
    return null;
  }
  const showPublicOption =
    isListedOn === null ? data?.projectBySlug?.isListed : isListedOn;
  return (
    <>
      <div className="mt-5">
        <form action="#" method="POST">
          <div className="shadow sm:rounded-md sm:overflow-hidden">
            <div className="px-4 py-5 bg-white sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {t("Access Control Settings")}
              </h3>
              <p className="mt-1 text-sm leading-5 text-gray-500">
                {t(
                  "These settings will control who can find and visit your project."
                )}
              </p>
              {mutationState.error && (
                <p className="text-sm text-red-900 my-2">
                  {t("Error saving settings.")} {mutationState.error.message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-900 my-2">
                  {t("Error fetching settings.")} {error.message}
                </p>
              )}
              <div className="ml-4 max-w-2xl mt-5">
                <div
                  className="relative flex items-start mt-4"
                  onClick={async (e) => {
                    if (!showPublicOption) {
                      if (
                        window.confirm(
                          t(
                            "Enabling public access will also enable public listing. Are you sure?"
                          )
                        )
                      ) {
                        setIsListedOn(true);
                        update({
                          isListed: true,
                          accessControl: ProjectAccessControlSetting.Public,
                        });
                      }
                    }
                  }}
                >
                  <div className="flex items-center h-5">
                    <input
                      name="access_control"
                      disabled={!showPublicOption}
                      id="PUBLIC"
                      type="radio"
                      style={showPublicOption ? {} : { pointerEvents: "none" }}
                      onChange={(e) => updateAccessControl("PUBLIC")}
                      checked={
                        accessControl
                          ? accessControl === "PUBLIC"
                          : data?.projectBySlug?.accessControl === "PUBLIC"
                      }
                      className="form-radio h-4 w-4 text-primary-500 transition duration-150 ease-in-out focus:ring focus:ring-blue-200"
                    />
                  </div>
                  <div
                    className={`ml-3 text-sm leading-5 ${
                      !showPublicOption && "opacity-50"
                    }`}
                  >
                    <label
                      htmlFor="PUBLIC"
                      className="font-medium text-gray-700"
                    >
                      {t("Public")}
                    </label>
                    <p className="text-gray-500">
                      <Trans ns="admin">
                        Anyone can visit the project and participate. Can only
                        be enabled for <b>listed</b> projects.
                      </Trans>
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="relative flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        name="access_control"
                        id="ADMINS_ONLY"
                        onChange={(e) => updateAccessControl("ADMINS_ONLY")}
                        checked={
                          accessControl
                            ? accessControl === "ADMINS_ONLY"
                            : data?.projectBySlug?.accessControl ===
                              "ADMINS_ONLY"
                        }
                        type="radio"
                        className="form-radio h-4 w-4 text-primary-500 focus:ring focus:ring-blue-200 transition duration-150 ease-in-out"
                      />
                    </div>
                    <div className="ml-3 text-sm leading-5">
                      <label
                        htmlFor="ADMINS_ONLY"
                        className="font-medium text-gray-700"
                      >
                        {t("Admins Only")}
                      </label>
                      <p className="text-gray-500">
                        {t(
                          "Only project administrators will be able to visit the site."
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="relative flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        name="access_control"
                        id="INVITE_ONLY"
                        onChange={(e) => updateAccessControl("INVITE_ONLY")}
                        checked={
                          accessControl
                            ? accessControl === "INVITE_ONLY"
                            : data?.projectBySlug?.accessControl ===
                              "INVITE_ONLY"
                        }
                        type="radio"
                        className="form-radio h-4 w-4 text-primary-500 transition duration-150 focus:ring focus:ring-blue-200 ease-in-out"
                      />
                    </div>
                    <div className="ml-3 text-sm leading-5">
                      <label
                        htmlFor="INVITE_ONLY"
                        className="font-medium text-gray-700"
                      >
                        {t("Invite Only")}
                      </label>
                      <p className="text-gray-500">
                        <Trans ns="admin">
                          Only approved participants can visit the project.
                          Admins can invite users by email and users can also
                          request access.
                        </Trans>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-7 border-t border-gray-200 pt-5">
                <div className="relative flex items-start">
                  <div className="ml-3 text-sm leading-5">
                    <div className="flex items-center -mt-2 py-4">
                      <label
                        htmlFor="PUBLIC"
                        className="font-medium text-gray-700"
                      >
                        {t("Public Listing")}
                      </label>
                      <Switch
                        className="absolute right-2"
                        isToggled={
                          isListedOn === null
                            ? data.projectBySlug!.isListed
                            : isListedOn
                        }
                        onClick={toggleIsListed}
                      />
                    </div>
                    <p className="text-gray-500">
                      <Trans ns="admin">
                        When enabled, this project will be listed on the
                        SeaSketch{" "}
                        <Link className="underline" to="/projects">
                          projects page
                        </Link>{" "}
                        and accessible to search engines. We recommend enabling
                        this setting even for private projects so that your
                        users can find the project easily and request access if
                        necessary.
                      </Trans>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

function MapExtentSettings() {
  const { t, i18n } = useTranslation(["admin"]);
  const [map, setMap] = useState<Map | null>(null);
  const [draw, setDraw] = useState<any>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const { slug } = useParams<{ slug: string }>();
  const [drawing, setDrawing] = useState(true);
  const { data, error, loading } = useProjectRegionQuery({
    variables: {
      slug,
    },
  });
  const [mutate, mutationState] = useUpdateProjectRegionMutation();

  const onRedrawBounds = () => {
    draw.deleteAll();
    draw.changeMode("draw_rectangle");
    setDrawing(true);
  };

  const zoomToFeature = (feature: any, map: Map) => {
    const box = bbox(feature);
    map.fitBounds(
      [
        [box[0], box[1]],
        [box[2], box[3]],
      ],
      { padding: 20 }
    );
  };

  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;
    if (!map && mapContainer.current) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11", // stylesheet location
        center: [1.9, 18.7],
        zoom: 0.09527381899319892,
      });

      const draw = new MapboxDraw({
        userProperties: true,
        displayControlsDefault: false,
        modes: {
          ...MapboxDraw.modes,
          draw_rectangle: DrawRectangle,
          static: StaticMode,
        },
      });
      // @ts-ignore
      window.MapboxDraw = MapboxDraw;
      mapInstance.on("load", () => {
        setMap(mapInstance);
        setDraw(draw);
        mapInstance.addControl(draw);
        // @ts-ignore
        window.draw = draw;

        // when mode drawing should be activated
        // draw.changeMode("draw_rectangle", {});
        mapInstance.resize();
        // @ts-ignore
        window.map = mapInstance;
      });

      mapInstance.on("draw.create", (e) => {
        setTimeout(() => {
          zoomToFeature(e.features[0], mapInstance);
          draw.changeMode("static");
          mutate({
            variables: {
              slug,
              region: e.features[0].geometry,
            },
          });
        }, 100);
        setDrawing(false);
      });
    }
  }, [map, mapContainer.current]);

  useEffect(() => {
    if (data && map && draw && draw.getAll().features.length === 0) {
      const feature = {
        type: "Feature",
        id: 1,
        properties: {},
        geometry: data.projectBySlug?.region.geojson,
      };
      draw.add(feature);
      draw.changeMode("static");
      const box = bbox(feature);
      map.fitBounds(
        [
          [box[0], box[1]],
          [box[2], box[3]],
        ],
        { padding: 20, duration: 0 }
      );
      // zoomToFeature(feature, map);
      draw.changeMode("static");
      setDrawing(false);
    }
  }, [data, map, draw]);

  return (
    <>
      <div className="mt-5 relative">
        <div className="shadow sm:rounded-md sm:overflow-hidden">
          <div className="px-4 py-5 bg-white sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {t("Map Extent Settings")}
            </h3>
            {mutationState.error && <p>{mutationState.error.message}</p>}
            <p className="mt-1 text-sm leading-5 text-gray-500">
              <Trans ns="admin">
                Draw a box around the region where your project will be used.
                SeaSketch will ensure that users see the entirety of this area
                when they first load the map, regardless of their display size.
              </Trans>
            </p>
            <div
              className="w-full h-72 mt-2"
              ref={(el) => (mapContainer.current = el)}
            ></div>
            <button
              className={`${
                drawing ? "hidden" : ""
              } sm:absolute sm:top-28 mt-2 sm:mt-0 sm:left-10 cursor-pointer inline-flex items-center px-4 py-2 border border-gray-400 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:text-gray-500 focus:ring focus:ring-blue-200 active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150`}
              onClick={onRedrawBounds}
            >
              {t("Redraw Bounds")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SuperUserSettings() {
  const { t, i18n } = useTranslation(["admin"]);
  const { slug } = useParams<{ slug: string }>();
  const [isFeatured, setIsFeatured] = useState<boolean | null>(null);
  const { data, loading, error } = useCurrentProjectMetadataQuery();
  const [mutate, mutationState] = useUpdateProjectSettingsMutation();

  if (loading) {
    return null;
  }

  const isFeaturedToggled =
    isFeatured === null ? data?.currentProject?.isFeatured : isFeatured;

  const toggleIsFeatured = () => {
    const featured = !isFeaturedToggled;
    setIsFeatured(featured);
    mutate({
      variables: {
        slug,
        isFeatured: featured,
      },
    }).catch((e) => {});
  };

  return (
    <>
      <div className="mt-5">
        <form action="#" method="POST">
          <div className="shadow sm:rounded-md sm:overflow-hidden">
            <div className="px-4 py-5 bg-white sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {t("SeaSketch Developer Settings")}
              </h3>
              <p className="mt-1 text-sm leading-5 text-gray-500">
                {t("These options are only visible to the SeaSketch team.")}
              </p>
              {mutationState.error && (
                <p className="text-sm text-red-900 my-2">
                  {t("Error saving settings.")} {mutationState.error.message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-900 my-2">
                  {t("Error fetching settings.")} {error.message}
                </p>
              )}
              <div className="mt-5">
                <div className="relative flex items-start">
                  <div className="ml-3 text-sm leading-5">
                    <div className="flex items-center -mt-2 py-4">
                      <label
                        htmlFor="candidates"
                        className="font-medium text-gray-700"
                      >
                        {t("Featured Project")}
                      </label>
                      <Switch
                        className="absolute right-2"
                        isToggled={isFeaturedToggled}
                        onClick={toggleIsFeatured}
                      />
                    </div>
                    <p className="text-gray-500">
                      {t(
                        "Featured projects will be displayed more prominently on project listing pages."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
