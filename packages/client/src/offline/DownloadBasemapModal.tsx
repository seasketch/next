import Modal from "../components/Modal";
import { Trans as T } from "react-i18next";
import { Header } from "../components/CenteredCardListLayout";
import { useMapDownloadManager } from "./MapDownloadManager";
import { BasemapDetailsFragment } from "../generated/graphql";
import Badge from "../components/Badge";
import bytes from "bytes";
import { CacheProgress } from "./CacheStatus";
import Button from "../components/Button";

const Trans = (props: any) => <T {...props} ns="offline"></T>;

export default function DownloadBasemapModal({
  maps,
  onRequestClose,
}: {
  maps: Pick<BasemapDetailsFragment, "id" | "url">[];
  onRequestClose: () => void;
}) {
  const { status, populateCache, cancel, initializing } = useMapDownloadManager(
    {
      maps,
    }
  );

  return (
    <Modal
      onRequestClose={onRequestClose}
      open={true}
      loading={initializing}
      footer={
        <>
          <Button label={<Trans>Close</Trans>} onClick={onRequestClose} />
          <Button
            primary
            disabled={status.working}
            label={
              status.fractionCached < 1 ? (
                <Trans>Start Download</Trans>
              ) : (
                <Trans>Clear Cache and Download Again</Trans>
              )
            }
            onClick={() => populateCache()}
          />
        </>
      }
    >
      <div className="w-128 space-y-2">
        <Header>
          <Trans i18nKey="downloadBasemaps" count={maps.length}>
            Download Basemaps
          </Trans>
        </Header>
        <p className="text-sm">
          <Trans>
            When downloading maps, be sure to leave the browser window open and
            prevent your computer from going to sleep until after the process is
            complete.
          </Trans>
        </p>

        {!initializing && !status.working && !status.error && (
          <>
            <Header>
              <Trans>Cache Status</Trans>
            </Header>
            <CacheProgress
              percent={status.fractionCached * 100}
              description={
                <div className="space-x-1">
                  {!initializing && status.staticAssets && (
                    <Badge>
                      <Trans>
                        {status.staticAssets.length.toString()} supporting files
                      </Trans>
                    </Badge>
                  )}
                  {!initializing && status.tilePackages && (
                    <Badge>
                      <Trans
                        ns="offline"
                        i18nKey="tilePackageDownloadStats"
                        count={status.tilePackages.length}
                      >
                        {{ count: status.tilePackages.length }} tile packages
                      </Trans>{" "}
                      (
                      {bytes(
                        status.tilePackages.reduce(
                          (sum, pkg) => sum + (pkg.bytes || 0),
                          0
                        )
                      )}
                      )
                    </Badge>
                  )}
                  {!status.working && status.fractionCached === 1 && (
                    <>
                      {status.staticAssets && (
                        <Badge>
                          <Trans>
                            {status.staticAssets.length.toString()} supporting
                            files
                          </Trans>
                        </Badge>
                      )}
                      <Trans>Map is ready for offline use.</Trans>
                    </>
                  )}
                </div>
              }
            />
          </>
        )}

        {status.working && (
          <div className="pt-3">
            <CacheProgress
              loading={true}
              percent={status.progress * 100}
              description={status.progressMessage}
            />
          </div>
        )}

        {status.error && (
          <p className="text-red-800">{status.error.toString()}</p>
        )}
      </div>
    </Modal>
  );
}
