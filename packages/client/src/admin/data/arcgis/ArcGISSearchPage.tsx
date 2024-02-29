import React, { useRef, useState } from "react";
import {
  CatalogItem,
  normalizeArcGISServerUrl,
  NormalizedArcGISServerLocation,
} from "./arcgis";
import useRecentDataServers from "./useRecentServers";
import { Trans } from "react-i18next";
import Spinner from "../../../components/Spinner";
import { ArcGISRESTServiceRequestManager } from "@seasketch/mapbox-gl-esri-sources";

export default function ArcGISSearchPage({
  onResult,
  requestManager,
}: {
  onResult?: (e: {
    location: NormalizedArcGISServerLocation;
    version: string;
    catalogItem?: CatalogItem;
    selectedFolder?: CatalogItem;
  }) => void;
  requestManager: ArcGISRESTServiceRequestManager;
}) {
  const [inputUrl, setInputUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [recentServers, addServer] = useRecentDataServers();
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const onSubmitServiceUrl = async () => {
    const l = normalizeArcGISServerUrl(inputUrl);
    loadServerUrl(l);
  };

  const loadServerUrl = async (
    location: NormalizedArcGISServerLocation & { updateInput?: boolean }
  ) => {
    if (location.updateInput && inputRef.current) {
      inputRef.current.value = location.baseUrl;
    }
    setInputError(null);
    if (/http:/.test(location.baseUrl)) {
      setInputError("Service protocol https:// is required.");
    } else {
      try {
        setLoading(true);
        const serviceResponse = await requestManager.getCatalogItems(
          location.servicesRoot
        );
        setLoading(false);
        if (serviceResponse.currentVersion) {
          addServer({ location: location.servicesRoot, type: "arcgis" });
          if (onResult) {
            let catalogItem: CatalogItem | undefined;
            let folder: CatalogItem | undefined;
            if (/\d[\/]*$/.test(location.location)) {
              location.location = location.location.replace(/\/\d[\/]*$/, "");
            }
            if (location.location.split("/").length > 3) {
              const folderName = location.location.split("/")[1];
              folder = {
                name: folderName,
                type: "Folder",
                url: location.servicesRoot + "/" + folderName,
              };
            }
            if (/MapServer/.test(location.location)) {
              catalogItem = {
                name: location.location.split("/")[1],
                type: "MapServer",
                url: location.servicesRoot + location.location,
              };
            } else if (/FeatureServer/.test(location.location)) {
              catalogItem = {
                name: location.location.split("/")[1],
                type: "FeatureServer",
                url: location.servicesRoot + location.location,
              };
            }
            onResult({
              location,
              version: serviceResponse.currentVersion.toString(),
              catalogItem,
              selectedFolder: folder,
            });
          }
          // setVersion(serviceResponse.currentVersion);
          // setLocation(location);
        } else {
          setInputError("Unrecognized server response");
        }
      } catch (e) {
        setLoading(false);
        console.error(e);
        setInputError(e.toString());
      }
    }
  };

  return (
    <div className="w-128 mx-auto relative -top-1/4 px-2">
      <label
        htmlFor="arcgis"
        className="block text-sm font-medium leading-5 text-gray-700"
      >
        <Trans ns="admin">Enter an ArcGIS Server Location</Trans>
      </label>
      <div className="mt-1 flex rounded-md shadow-sm">
        <div className="relative flex-grow focus-within:z-10">
          <input
            disabled={loading}
            ref={inputRef}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSubmitServiceUrl();
              }
            }}
            id="arcgis"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className={`p-2 ${
              loading ? "bg-gray-100" : "bg-white"
            } block w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5`}
            placeholder="https://example.com/argis/rest/services"
          />
        </div>
        <button
          onClick={onSubmitServiceUrl}
          style={{ marginTop: -1 }}
          className="-ml-2 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm leading-5 font-medium rounded-r-md text-gray-700 bg-gray-50 hover:text-gray-500 hover:bg-white focus:outline-none focus:shadow-outline-blue focus:border-blue-300 active:bg-gray-100 active:text-gray-700 transition ease-in-out duration-150"
        >
          <div className="flex items-center justify-center w-5 h-5">
            {loading ? (
              <Spinner className="scale-80" />
            ) : (
              <svg
                className="text-gray-800 w-4 h-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
          </div>
          <span className="ml-2">
            <Trans ns="admin">Browse</Trans>
          </span>
        </button>
      </div>
      {inputError && <p className="text-sm text-red-900">{inputError}</p>}
      {recentServers && recentServers.length > 0 && (
        <div className="pt-6">
          <h4 className="block text-sm font-medium leading-5 text-gray-700">
            <Trans ns="admin">Recently Used Servers</Trans>
          </h4>
          <ul className="pt-2">
            {recentServers
              .filter((server) => server.type === "arcgis")
              .map((server) => (
                <li
                  key={server.location
                    .replace("arcgis/rest/services", "")
                    .replace("rest/services", "")}
                  className="text-sm text-gray-700 hover:text-gray-900 cursor-pointer"
                  onClick={() => {
                    const l = normalizeArcGISServerUrl(server.location);
                    loadServerUrl(l);
                  }}
                >
                  {server.location
                    .replace("arcgis/rest/services", "")
                    .replace("rest/services", "")}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
