import bytes from "bytes";
import ProgressBar from "../components/ProgressBar";
import {
  DeleteTilePackageDocument,
  OfflineTilePackageDetailsFragment,
  OfflineTilePackageSourceType,
  OfflineTilePackageStatus,
  useGetTilePackageLazyQuery,
} from "../generated/graphql";
import { useEffect, useMemo } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/solid";
import { useDelete } from "../graphqlHookWrappers";
import useDialog from "../components/useDialog";
import { Trans } from "react-i18next";

export default function TilePackageListItem({
  pkg,
}: {
  pkg: OfflineTilePackageDetailsFragment;
}) {
  const inProgress = useMemo(() => {
    return (
      pkg.jobStatus === OfflineTilePackageStatus.Generating ||
      pkg.jobStatus === OfflineTilePackageStatus.Uploading ||
      pkg.jobStatus === OfflineTilePackageStatus.Queued
    );
  }, [pkg.jobStatus]);

  const query = useGetTilePackageLazyQuery({
    pollInterval: inProgress ? 1000 : 0,
    variables: {
      id: pkg.id,
    },
  });

  useEffect(() => {
    if (inProgress) {
      query[0]();
    }
  }, []);

  const { confirm } = useDialog();

  const onDelete = useDelete(DeleteTilePackageDocument);

  return (
    <div className="p-2 my-2 flex w-full text-sm" key={pkg.id}>
      <Icon error={Boolean(pkg.jobErrors)} type={pkg.sourceType} />
      <div className="flex-1 overflow-hidden">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <a
          download={true}
          href={pkg.presignedUrl}
          className={`text-sm truncate max-w-full ${
            pkg.jobErrors || inProgress
              ? "pointer-events-none text-gray-500"
              : "underline"
          }`}
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {`${pkg.id}.mbtiles`}
        </a>
        <h2 className="text-sm truncate max-w-full">{pkg.dataSourceUrl}</h2>
        {pkg.jobErrors && (
          <p className="text-red-800 ">
            <ExclamationCircleIcon className="w-5 h-5 inline-block" />
            {pkg.jobErrors}
          </p>
        )}
        {inProgress && (
          <>
            <ProgressBar progress={pkg.tilesFetched / pkg.totalTiles} />
            {pkg.jobStatus === OfflineTilePackageStatus.Queued &&
              "Waiting in queue..."}
            {pkg.jobStatus !== OfflineTilePackageStatus.Queued && (
              <>
                {pkg.tilesFetched.toLocaleString()} /{" "}
                {/* eslint-disable-next-line i18next/no-literal-string */}
                {pkg.totalTiles.toLocaleString()} tiles saved.{" "}
                {pkg.jobStatus === OfflineTilePackageStatus.Uploading &&
                  "Uploading..."}
              </>
            )}
          </>
        )}
        {!inProgress && (
          <>
            {Boolean(pkg.bytes) && Boolean(pkg.totalTiles) && (
              <p>
                {/* eslint-disable-next-line i18next/no-literal-string*/}
                {bytes(pkg.bytes)}, {pkg.totalTiles.toLocaleString()} tiles.{" "}
                <span className="">
                  {pkg.maxShorelineZ
                    ? // eslint-disable-next-line i18next/no-literal-string
                      `z${pkg.maxZ}-${pkg.maxShorelineZ}`
                    : // eslint-disable-next-line i18next/no-literal-string
                      `z${pkg.maxZ}`}
                </span>
              </p>
            )}
            {
              // eslint-disable-next-line i18next/no-literal-string
              <p>
                Created {new Date(pkg.createdAt).toLocaleString()}{" "}
                <button
                  onClick={async () => {
                    if (
                      await confirm(
                        `Are you sure you want to delete this tile package? Regenerating it may incure Mapbox fees.`
                      )
                    ) {
                      onDelete(pkg);
                    }
                  }}
                  className="p-0 border rounded px-1 shadow-sm"
                >
                  <Trans ns="admin:offline">delete</Trans>
                </button>
              </p>
            }
          </>
        )}
      </div>
    </div>
  );
}

function Icon({
  type,
  error,
}: {
  type: OfflineTilePackageSourceType;
  error?: boolean;
}) {
  const size = 40;
  return (
    <div
      className={` ${
        error
          ? "bg-gradient-to-b from-red-800 to-red-900"
          : "bg-gradient-to-b from-primary-500 to-primary-600"
      } flex-none shadow  flex p-3 mr-2 w-20 justify-center items-center flex-col text-center text-xs text-blue-50 rounded`}
    >
      {type === OfflineTilePackageSourceType.Vector && (
        <svg
          viewBox="0 0 24 24"
          height={size}
          width={size}
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className="StyledIconBase-ea9ulj-0 bWRyML"
        >
          <path d="M20 14.185v-2.369A2.997 2.997 0 0 0 22 9c0-1.654-1.346-3-3-3a2.99 2.99 0 0 0-2.116.876L12.969 5.31c.01-.103.031-.204.031-.31 0-1.654-1.346-3-3-3S7 3.346 7 5c0 .762.295 1.451.765 1.981L6.091 9.212A2.977 2.977 0 0 0 5 9c-1.654 0-3 1.346-3 3s1.346 3 3 3c.159 0 .313-.023.465-.047L7.4 17.532c-.248.436-.4.932-.4 1.468 0 1.654 1.346 3 3 3a2.994 2.994 0 0 0 2.863-2.153l3.962-.792A2.987 2.987 0 0 0 19 20c1.654 0 3-1.346 3-3a2.995 2.995 0 0 0-2-2.815zM19 8a1.001 1.001 0 1 1-1 1c0-.551.448-1 1-1zm-9-4a1.001 1.001 0 1 1-1 1c0-.551.448-1 1-1zm-6 8a1.001 1.001 0 1 1 1 1c-.552 0-1-.449-1-1zm6 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm2.761-2.172A3.005 3.005 0 0 0 10 16c-.386 0-.752.079-1.091.213l-1.674-2.231C7.705 13.451 8 12.762 8 12c0-.536-.152-1.032-.399-1.467l1.935-2.58c.152.024.305.047.464.047a2.99 2.99 0 0 0 2.116-.876l3.915 1.566c-.01.103-.031.204-.031.31 0 1.302.839 2.401 2 2.815v2.369a2.996 2.996 0 0 0-2 2.815c0 .061.015.117.018.177l-3.257.652zM19 18a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"></path>
        </svg>
      )}
      {type === OfflineTilePackageSourceType.Raster && (
        <svg
          viewBox="0 0 24 24"
          height={size}
          width={size}
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"></path>
        </svg>
      )}
      {type === OfflineTilePackageSourceType.RasterDem && (
        <svg
          viewBox="0 0 24 24"
          height={size}
          width={size}
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path fill="none" d="M0 0h24v24H0z"></path>
          <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"></path>
        </svg>
      )}
      <span>
        <Trans ns="admin:offline">
          {type === OfflineTilePackageSourceType.RasterDem
            ? "dem"
            : type.toString().toLowerCase()}
        </Trans>
      </span>
    </div>
  );
}
