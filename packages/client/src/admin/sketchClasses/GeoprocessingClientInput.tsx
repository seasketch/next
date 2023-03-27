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

export default function GeoprocessingClientInput({
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
  const [clients, setClients] = useState<ClientDetails[]>([]);

  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useUpdateGeoprocessingServicesMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateSketchClass: {
          __typename: "UpdateSketchClassPayload",
          sketchClass: {
            preprocessingEndpoint: sketchClass.preprocessingEndpoint,
            preprocessingProjectUrl: sketchClass.preprocessingProjectUrl,
            ...data,
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
            if (data.clients.length === 0) {
              throw new Error(
                `${data.title} does not contain any geoprocessing clients`
              );
            } else {
              setError(null);
              setLoading(false);
              setClients(
                data.clients.map(
                  (client: any) =>
                    ({
                      author: data.author,
                      clientSideBundle: data.clientSideBundle,
                      projectTitle: data.title,
                      projectUrl: data.uri,
                      published: new Date(data.published),
                      title: client.title || client.name,
                    } as ClientDetails)
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
      clientSideBundle,
      title,
    }: {
      projectTitle: string;
      clientSideBundle: string;
      title: string;
      projectUrl: string;
    }) => {
      setUrl("");
      setClients([]);
      addProject({
        url: projectUrl,
        name: projectTitle,
      });
      await mutate({
        variables: {
          id: sketchClass.id,
          geoprocessingClientName: title,
          geoprocessingClientUrl: clientSideBundle,
          geoprocessingProjectUrl: projectUrl,
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
    setClients([]);
  }, [setUrl, setDialogOpen]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium leading-5 text-gray-800">
        <Trans ns="admin:sketching">Geoprocessing</Trans>
      </h3>
      <p className="text-gray-500 text-sm">
        <Trans ns="admin:sketching">
          Geoprocessing services and clients define the reporting tools that
          will appear when inspecting this Sketch.
        </Trans>
      </p>
      {(!sketchClass.geoprocessingClientName ||
        !sketchClass.geoprocessingClientUrl ||
        !sketchClass.geoprocessingProjectUrl) && (
        <button
          onClick={() => setDialogOpen(true)}
          className="hover:shadow rounded p-4 text-sm border shadow-sm w-full text-left text-gray-500 flex items-center"
        >
          <span className="flex-1">
            <Trans ns="admin:sketching">Specify a geoprocessing client</Trans>
          </span>
          <ChevronRightIcon className="w-6 h-6 text-gray-400" />
        </button>
      )}

      {sketchClass.geoprocessingClientName &&
        sketchClass.geoprocessingClientUrl &&
        sketchClass.geoprocessingProjectUrl && (
          <GeoprocessingClientButton
            onClick={() => setDialogOpen(true)}
            geoprocessingClientName={sketchClass.geoprocessingClientName}
            geoprocessingClientUrl={sketchClass.geoprocessingClientUrl}
            geoprocessingProjectUrl={sketchClass.geoprocessingProjectUrl}
            // preprocessingEndpoint={sketchClass.preprocessingEndpoint}
            // preprocessingProjectUrl={sketchClass.preprocessingProjectUrl}
          />
        )}
      {dialogOpen &&
        createPortal(
          <Modal
            autoWidth
            onRequestClose={onRequestClose}
            // title={<Trans ns="admin:sketching">Choose a processing function</Trans>}
            footer={[
              {
                label: <Trans ns="admin:sketching">Cancel</Trans>,
                onClick: onRequestClose,
              },
              ...(sketchClass.preprocessingEndpoint
                ? [
                    {
                      label: (
                        <Trans ns="admin:sketching">
                          Remove Service Configuration
                        </Trans>
                      ),
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
                  geoprocessing client you would like to use.
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
              {clients.length === 0 && !error && (
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
              {clients.length > 0 && (
                <div className="space-y-2">
                  <div className="py-2">
                    <h2 className="flex text-sm">
                      <span className="flex-1 font-bold text-primary-500">
                        {clients[0].projectTitle}
                      </span>
                    </h2>
                    <h3 className="text-sm">
                      <Trans ns="admin:sketching">Authored by</Trans>{" "}
                      {clients[0].author}
                    </h3>
                    <h3 className="text-sm">
                      <Trans ns="admin:sketching">last published </Trans>
                      {clients[0].published.toLocaleDateString()}
                    </h3>
                  </div>
                  <h2 className="text-sm font-semibold mt-4">
                    <Trans ns="admin:sketching">
                      Choose a geoprocessing client
                    </Trans>
                  </h2>
                  {clients.map((client) => (
                    <button
                      key={client.title}
                      disabled={loading && mutationState.loading}
                      onClick={() => onButtonClick(client)}
                      className="hover:shadow rounded p-2 text-sm shadow-sm border w-full text-left"
                    >
                      <h3 className="flex truncate">
                        <span className="flex-1 underline">{client.title}</span>
                      </h3>
                      <h4 className="truncate text-gray-400">
                        {client.clientSideBundle}
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

interface ClientDetails {
  title: string;
  clientSideBundle: string;
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

export function GeoprocessingClientButton({
  geoprocessingClientUrl,
  geoprocessingClientName,
  geoprocessingProjectUrl,
  onClick,
}: {
  geoprocessingClientName: string;
  geoprocessingClientUrl: string;
  geoprocessingProjectUrl: string;
  onClick?: () => void;
}) {
  const [data, setData] = useState<{
    title: string;
    updated: Date;
    author: string;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (geoprocessingProjectUrl) {
      fetch(geoprocessingProjectUrl)
        .then(async (res) => {
          const data: any = await res.json();
          if (!data.clients) {
            throw new Error("Invalid geoprocessing project");
          } else if (data.clients.length === 0) {
            throw new Error("This project contains no geoprocessing clients");
          }
          const client = data.clients.find(
            (c: any) =>
              c.title === geoprocessingClientName ||
              c.name === geoprocessingClientName
          );
          if (!client) {
            throw new Error(
              "Project does not appear to contain configured client"
            );
          }
          setData({
            title: client.title || client.name,
            author: data.author,
            updated: new Date(data.published),
          });
        })
        .catch((e) => {
          setError(e);
        });
    }
  }, [geoprocessingClientName, geoprocessingProjectUrl]);

  const linkBlock = (
    <p className="text-sm text-gray-400 flex w-11/12 items-center">
      <span className="truncate">{geoprocessingClientUrl}</span>
      <a
        onClick={(e) => e.stopPropagation()}
        href={geoprocessingProjectUrl}
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
