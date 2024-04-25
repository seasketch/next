import { Trans, useTranslation } from "react-i18next";
import {
  AuthorProfileFragment,
  DataSourceTypes,
  FullAdminDataLayerFragment,
  FullAdminOverlayFragment,
  FullAdminSourceFragment,
} from "../../../generated/graphql";
import { ReactNode, useMemo, useState } from "react";
import LayerInfoList, { isRemoteSource } from "./LayerInfoList";
import InlineAuthor from "../../../components/InlineAuthor";

export default function LayerVersioning({
  item,
}: {
  item: FullAdminOverlayFragment;
}) {
  const { t } = useTranslation("admin:data");

  const versions = useMemo(() => {
    const versions = [{ version: 1, source: item.dataLayer!.dataSource! }] as {
      version: number;
      source: FullAdminSourceFragment;
    }[];
    return versions.sort((a, b) => b.version - a.version);
  }, [item]);

  const [selectedVersion, setSelectedVersion] = useState(versions[0].version);

  const isSingleEsriVectorSource = useMemo(() => {
    if (
      item.dataSourceType ===
        DataSourceTypes.ArcgisDynamicMapserverVectorSublayer ||
      item.dataSourceType === DataSourceTypes.ArcgisVector
    ) {
      return true;
    }
    return false;
  }, [item]);

  return (
    <Container>
      <VersionsContainer>
        <h2 className="font-medium px-2 py-1">{t("Versions")}</h2>
        <div className="px-8 py-4">
          {versions.map(({ version, source }, i) => (
            <VersionListItem
              isUpload={!isRemoteSource(source.type)}
              authorProfile={source.authorProfile || undefined}
              key={version}
              version={version}
              createdAt={new Date(source.createdAt)}
              selected={version === selectedVersion}
              current={item.dataLayer?.dataSourceId === source.id}
              isMostRecent={i === 0}
              isOldest={i === versions.length - 1}
              onClick={() => setSelectedVersion(version)}
            />
          ))}
        </div>
        {versions.length === 1 && versions[0].version === 1 && (
          <>
            <div className="py-5 px-2 rounded  text-gray-500 text-sm space-y-4">
              <p>
                <Trans ns="admin:data">
                  This is the first version of this data source. SeaSketch can
                  track changes to this layer as you upload new revisions,
                  enabling you to monitor changes over time and rollback to
                  previous versions.
                </Trans>
              </p>
              <p>
                <Trans ns="admin:data">
                  Drag & Drop a spatial data file here to create a new version
                  of this layer, or{" "}
                  <button className="underline text-primary-500">
                    browse for files on your computer
                  </button>
                  .
                </Trans>
              </p>
              {/* {isSingleEsriVectorSource && (
                <p>
                  <Trans ns="admin:data">
                    Given that this layer is an Esri vector source, you can also
                    <button className="underline text-primary-500">
                      convert it to a SeaSketch-hosted source
                    </button>
                    . After conversion, you will still be able to access and
                    rollback to the original Esri source.
                  </Trans>
                </p>
              )} */}
            </div>
          </>
        )}
        {versions.length > 1 && (
          <p className="text-sm text-gray-500">
            {versions.map(({ version, source }) => (
              <div key={version}>
                <h3 className="text-base font-medium leading-6 text-gray-900">
                  {t("version")} {version}
                </h3>
                <p className="text-sm text-gray-500">
                  {t("version")} {version} {t("details")}
                </p>
                <div>{source.type}</div>
                {source.uploadedBy && (
                  <div>
                    {t("uploadedBy")}: {source.uploadedBy}
                    {new Date(source.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </p>
        )}
      </VersionsContainer>
      <VersionDetails
        version={selectedVersion}
        source={versions.find((v) => v.version === selectedVersion)!.source}
        layer={item.dataLayer!}
      />
    </Container>
  );
}

function Container({ children }: { children: ReactNode }) {
  return <div className="h-full bg-gray-100 flex flex-col">{children}</div>;
}

function VersionsContainer({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxHeight: "33%" }} className="overflow-y-auto p-2 bg-white">
      {children}
    </div>
  );
}

function VersionDetails({
  source,
  version,
  layer,
}: {
  source: FullAdminSourceFragment;
  version: number;
  layer: Pick<FullAdminDataLayerFragment, "sublayer" | "sublayerType">;
}) {
  return (
    <div className="flex-2 p-4 border-t">
      <h2 className="text-base font-medium leading-6 text-gray-900">
        <Trans ns="admin:data">
          Version {version.toString()} details and settings
        </Trans>
      </h2>
      <div className="border rounded mt-4 overflow-hidden bg-white">
        <LayerInfoList source={source} layer={layer} readonly={false} />
      </div>
    </div>
  );
}

function VersionListItem({
  version,
  createdAt,
  selected,
  current,
  onClick,
  isOldest,
  authorProfile,
  isUpload,
}: {
  version: number;
  createdAt: Date;
  selected: boolean;
  current: boolean;
  isMostRecent: boolean;
  isOldest: boolean;
  onClick: () => void;
  isUpload?: boolean;
  authorProfile?: Pick<
    AuthorProfileFragment,
    "affiliations" | "email" | "fullname" | "nickname" | "picture" | "userId"
  >;
}) {
  const { t } = useTranslation("admin:data");
  return (
    <div className="relative flex items-center space-x-2">
      <VersionDot selected version={version} blendTail={isOldest} />
      <div className="flex space-x-1 text-sm font-medium items-center">
        <span>{isUpload ? t("Uploaded") : t("Created")}</span>
        <span>{createdAt.toLocaleDateString()}</span>
        <span>
          <Trans ns="admin:data">by</Trans>
        </span>
        {authorProfile ? (
          <span>
            {authorProfile.fullname ||
              authorProfile.nickname ||
              authorProfile.email}
          </span>
        ) : (
          <span>
            <Trans ns="admin:data">Unknown author</Trans>
          </span>
        )}
      </div>
    </div>
  );
}

function VersionDot({
  version,
  selected,
  onClick,
  isLoading,
  blendTail,
}: {
  version: number;
  selected?: boolean;
  onClick?: () => void;
  isLoading?: boolean;
  blendTail?: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={
          selected
            ? "rounded-full border-4 border-blue-300"
            : "border-transparent rounded-full border-4"
        }
      >
        <div
          style={{ zIndex: 2 }}
          className="relative rounded-full w-9 h-9 bg-blue-100 border-4 border-blue-500 text-blue-700 text-center flex items-center justify-center font-bold"
        >
          <span>{version}</span>
        </div>
      </div>
      <div
        style={{
          background: blendTail
            ? "linear-gradient(180deg, rgba(150,150,150,1) 0%, rgba(150,150,150,1) 15%, rgba(150,150,150,0) 100%)"
            : "rgba(150,150,150,1)",
          zIndex: 1,
          marginLeft: -2,
        }}
        className="absolute top-7 h-8 w-1 left-1/2 bg-gray-500"
      ></div>
    </div>
  );
}
