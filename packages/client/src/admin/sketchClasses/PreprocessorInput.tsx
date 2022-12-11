import { ChevronRightIcon, ExternalLinkIcon } from "@heroicons/react/outline";
import { XCircleIcon } from "@heroicons/react/solid";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trans } from "react-i18next";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Modal, { FooterButtonProps } from "../../components/Modal";
import Skeleton from "../../components/Skeleton";
import Warning from "../../components/Warning";
import {
  SketchGeometryType,
  SketchingDetailsFragment,
  useUpdateGeoprocessingServicesMutation,
} from "../../generated/graphql";
import useLocalStorage from "../../useLocalStorage";

export default function PreprocessorInput({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { recentlyUsedProjects, addProject } =
    useRecentlyUsedGeoprocessingProjects();
  const [preprocessingServices, setPreprocessingServices] = useState<
    PreprocessingServiceDetails[]
  >([]);

  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useUpdateGeoprocessingServicesMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateSketchClass: {
          __typename: "UpdateSketchClassPayload",
          sketchClass: {
            ...data,
            geoprocessingClientName: sketchClass.geoprocessingClientName,
            geoprocessingClientUrl: sketchClass.geoprocessingClientUrl,
            geoprocessingProjectUrl: sketchClass.geoprocessingProjectUrl,
          },
        },
      };
    },
  });

  const search = useCallback(
    async (value?: string) => {
      if (typeof value !== "string") {
        value = undefined;
      }
      setLoading(true);
      const urlString = value || url;
      if (urlString.length === 0) {
        setError("You must enter a valid url");
        setLoading(false);
      }
      await fetch(urlString)
        .then(async (res) => {
          const data = await res.json();
          if (data.title && data.apiVersion && data.preprocessingServices) {
            if (data.preprocessingServices.length === 0) {
              throw new Error(
                `${data.title} does not contain any preprocessing services`
              );
            } else {
              setError(null);
              setLoading(false);
              setPreprocessingServices(
                data.preprocessingServices.map(
                  (service: any) =>
                    ({
                      author: data.author,
                      endpoint: service.endpoint,
                      projectTitle: data.title,
                      projectUrl: data.uri,
                      published: new Date(data.published),
                      title: service.title,
                      description: service.description,
                    } as PreprocessingServiceDetails)
                )
              );
            }
          } else {
            throw new Error(
              "Does not appear to be a valid geoprocessing project."
            );
          }
        })
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    },
    [url]
  );

  const onButtonClick = useCallback(
    async ({
      projectTitle,
      projectUrl,
      endpoint,
    }: {
      projectTitle: string;
      endpoint: string;
      title: string;
      projectUrl: string;
    }) => {
      setUrl("");
      setPreprocessingServices([]);
      addProject({
        url: projectUrl,
        name: projectTitle,
      });
      await mutate({
        variables: {
          id: sketchClass.id,
          preprocessingEndpoint: endpoint,
          preprocessingProjectUrl: projectUrl,
        },
      });
      setDialogOpen(false);
    },
    [addProject, mutate, sketchClass.id]
  );
  const onRequestClose = useCallback(() => {
    setDialogOpen(false);
    setLoading(false);
    setUrl("");
    setError(null);
    setPreprocessingServices([]);
  }, [setUrl, setDialogOpen]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium leading-5 text-gray-800">
        <Trans ns="admin:sketching">Preprocessing Service</Trans>
      </h3>
      <p className="text-gray-500 text-sm">
        <Trans ns="admin:sketching">
          These services accept user input and perform transformation and
          validation functions, such as erasing land from a water polygon or
          ensuring a zone falls within a nation's exclusive economic zone (EEZ).
        </Trans>
      </p>
      {(!sketchClass.preprocessingEndpoint ||
        !sketchClass.preprocessingProjectUrl) &&
        sketchClass.geometryType === SketchGeometryType.Polygon && (
          <button
            onClick={() => setDialogOpen(true)}
            className="hover:shadow rounded p-4 text-sm border shadow-sm w-full text-left text-gray-500 flex items-center"
          >
            <span className="flex-1">
              <Trans>Specify a preprocessing service</Trans>
            </span>
            <ChevronRightIcon className="w-6 h-6 text-gray-400" />
          </button>
        )}

      {(!sketchClass.preprocessingEndpoint ||
        !sketchClass.preprocessingProjectUrl) &&
        sketchClass.geometryType !== SketchGeometryType.Polygon && (
          <div className=" rounded p-4 text-sm border shadow-sm w-full text-left text-gray-500 flex items-center opacity-50">
            <Trans ns="admin:sketching">
              Preprocessing services only support polygons at this time, with
              support planned for a future version of the tool.
            </Trans>
          </div>
        )}
      {sketchClass.preprocessingEndpoint &&
        sketchClass.preprocessingProjectUrl && (
          <PreprocessorButton
            onClick={() => setDialogOpen(true)}
            preprocessingEndpoint={sketchClass.preprocessingEndpoint}
            preprocessingProjectUrl={sketchClass.preprocessingProjectUrl}
          />
        )}
      {dialogOpen &&
        createPortal(
          <Modal
            autoWidth
            onRequestClose={onRequestClose}
            // title={<Trans>Choose a processing function</Trans>}
            footer={[
              {
                label: <Trans>Cancel</Trans>,
                onClick: onRequestClose,
              },
              ...(sketchClass.preprocessingEndpoint
                ? [
                    {
                      label: <Trans>Remove Service Configuration</Trans>,
                      loading: mutationState.loading,
                      onClick: async () => {
                        await mutate({
                          variables: {
                            id: sketchClass.id,
                            preprocessingEndpoint: null,
                            preprocessingProjectUrl: null,
                          },
                        });
                        onRequestClose();
                      },
                      variant: "trash",
                    } as FooterButtonProps,
                  ]
                : []),
            ]}
          >
            <div className="py-2 max-w-full w-128 space-y-2 pt-4">
              <p className="text-gray-500 text-sm">
                <Trans ns="admin:sketching">
                  Enter the service endpoint of a geoprocessing project with the
                  preprocessing function you would like to use.
                </Trans>
              </p>
              <div className="flex gap-2">
                <input
                  disabled={loading && mutationState.loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      search();
                    }
                  }}
                  onChange={(e) => setUrl(e.target.value)}
                  value={url}
                  placeholder={
                    "e.g. https://h13gfvr460.execute-api.us-west-2.amazonaws.com/prod"
                  }
                  autoFocus
                  name="preprocessor-servince-endpoint"
                  autoComplete="off"
                  className="flex-1 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
                  type="text"
                />
                <Button
                  onClick={search}
                  loading={loading}
                  disabled={loading && mutationState.loading}
                  primary
                  label={<Trans ns="admin:sketching">Search</Trans>}
                />
              </div>
              {preprocessingServices.length === 0 && !error && (
                <>
                  <h3 className="text-sm text-gray-500 pt-1">
                    <Trans ns="admin:sketching">
                      Or select a recently used project...
                    </Trans>
                  </h3>
                  <div className="space-x-2">
                    {recentlyUsedProjects.map((p) => (
                      <Button
                        disabled={loading && mutationState.loading}
                        onClick={() => {
                          setUrl(p.url);
                          search(p.url);
                        }}
                        small
                        // className="text-gray-700 text-sm mr-2 border rounded px-2 py-1 shadow-sm"
                        key={p.url}
                        label={p.name}
                      />
                    ))}
                  </div>
                </>
              )}
              {error && <Warning level="error">{error}</Warning>}
              {preprocessingServices.length > 0 && (
                <div className="space-y-2">
                  <div className="py-2">
                    <h2 className="flex text-sm">
                      <span className="flex-1 font-bold text-primary-500">
                        {preprocessingServices[0].projectTitle}
                      </span>
                    </h2>
                    <h3 className="text-sm">
                      <Trans ns="admin:sketching">Authored by</Trans>{" "}
                      {preprocessingServices[0].author}
                    </h3>
                    <h3 className="text-sm">
                      <Trans ns="admin:sketching">last published </Trans>
                      {preprocessingServices[0].published.toLocaleDateString()}
                    </h3>
                  </div>
                  <h2 className="text-sm font-semibold mt-4">
                    <Trans ns="admin:sketching">
                      Choose a preprocessing function
                    </Trans>
                  </h2>
                  {preprocessingServices.map((service) => (
                    <button
                      key={service.endpoint}
                      disabled={loading && mutationState.loading}
                      onClick={() => onButtonClick(service)}
                      className="hover:shadow rounded p-2 text-sm shadow-sm border w-full text-left"
                    >
                      <h3 className="flex truncate">
                        <span className="flex-1 underline">
                          {service.title}
                        </span>
                      </h3>
                      <p className="text-sm">{service.description}</p>
                      <h4 className="truncate text-gray-400">
                        {service.endpoint}
                      </h4>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Modal>,
          document.body
        )}
    </div>
  );
}

interface PreprocessingServiceDetails {
  title: string;
  description?: string;
  endpoint: string;
  author: string;
  projectTitle: string;
  published: Date;
  projectUrl: string;
}

export function useRecentlyUsedGeoprocessingProjects() {
  const [recentlyUsedProjects, setRecentlyUsedProjects] = useLocalStorage<
    { name: string; url: string }[]
  >("recently-used-geoprocessing-projects", []);

  const addProject = useCallback(
    (project: { name: string; url: string }) => {
      setRecentlyUsedProjects((prev) => {
        return [project, ...prev.filter((p) => p.url !== project.url)].slice(
          0,
          5
        );
      });
    },
    [setRecentlyUsedProjects]
  );

  return { recentlyUsedProjects, addProject };
}

export function PreprocessorButton({
  preprocessingEndpoint,
  preprocessingProjectUrl,
  onClick,
}: {
  preprocessingProjectUrl: string;
  preprocessingEndpoint: string;
  onClick?: () => void;
}) {
  const [data, setData] = useState<{
    title: string;
    updated: Date;
    author: string;
    description?: string;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (preprocessingEndpoint && preprocessingProjectUrl) {
      fetch(preprocessingProjectUrl)
        .then(async (res) => {
          const data: any = await res.json();
          if (!data.preprocessingServices) {
            throw new Error("Invalid geoprocessing project");
          } else if (data.preprocessingServices.length === 0) {
            throw new Error("This project contains no geoprocessing services");
          }
          const preprocessingService = data.preprocessingServices.find(
            (p: any) => p.endpoint === preprocessingEndpoint
          );
          if (!preprocessingService) {
            throw new Error(
              "Project does not appear to contain configured preprocessing endpoint"
            );
          }
          setData({
            title: preprocessingService.title,
            author: data.author,
            updated: new Date(data.published),
            description: preprocessingService.description,
          });
        })
        .catch((e) => {
          setError(e);
        });
    }
  }, [preprocessingProjectUrl, preprocessingEndpoint]);

  const linkBlock = (
    <p className="text-sm text-gray-400 flex w-11/12 items-center">
      <span className="truncate">{preprocessingEndpoint}</span>
      <a
        onClick={(e) => e.stopPropagation()}
        href={preprocessingEndpoint.split("/").slice(0, -1).join("/")}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLinkIcon className="w-4 h-4" />
      </a>
    </p>
  );

  return (
    <button
      onClick={onClick}
      className="hover:shadow rounded p-4 text-sm border shadow-sm w-full text-left text-gray-500 flex-inline flex items-center overflow-hidden"
    >
      <div className="flex-1 overflow-hidden">
        {!data && !error && (
          <>
            <Skeleton className="w-1/3 h-3" />
            <Skeleton className="w-full h-3" />
            <Skeleton className="w-1/2 h-3" />
            <br />
            <Skeleton className="w-1/2 h-3" />
            {linkBlock}
          </>
        )}
        {data && (
          <>
            <h2 className="text-black font-semibold">{data.title}</h2>
            <p className="text-sm text-black">{data.description}</p>
            <h3>
              <Trans ns="admin:sketching">Authored by</Trans> {data.author}
            </h3>
            <h3 className="">
              {" "}
              <Trans ns="admin:sketching">Last updated</Trans>{" "}
              {data.updated.toLocaleDateString()}
            </h3>
            {linkBlock}
          </>
        )}
        {!data && error && (
          <>
            <div className="flex items-center py-2 text-base">
              <XCircleIcon className="text-red-600 w-5 h-5 mr-1" />
              <span>{error.message}</span>
            </div>
            {linkBlock}
          </>
        )}
      </div>
      <ChevronRightIcon className="w-6 h-6 text-gray-400" />
    </button>
  );
}
