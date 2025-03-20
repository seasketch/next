import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  FullAdminSourceFragment,
  useReplacePmTilesMutation,
} from "../../generated/graphql";

export default function CustomizeTilesModal({
  onRequestClose,
  source,
}: {
  onRequestClose: () => void;
  source: Pick<FullAdminSourceFragment, "id" | "type">;
}) {
  const { t } = useTranslation("admin:data");
  const [mutation, mutationState] = useReplacePmTilesMutation();
  return (
    <Modal
      title={t("Replace Tileset")}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Cancel"),
          onClick: onRequestClose,
        },
        {
          label: t("Choose a PMTiles file"),
          loading: mutationState.loading,
          disabled: mutationState.loading,
          onClick: () => {
            // create a file input element and click it to trigger the file
            // dialog
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pmtiles";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              console.log(file);
              if (
                file.type !== "application/vnd.pmtiles" &&
                !file.name.endsWith(".pmtiles")
              ) {
                alert("File must be a PMTiles file");
                return;
              }
              await mutation({
                variables: {
                  dataSourceId: source.id,
                  pmtiles: file,
                },
              }).catch((e) => {
                alert(e.message);
              });
              // upload the file to the server
              // const url = await uploadFile(file);
              // console.log("uploaded file to", url);
            };
            input.click();
          },
          variant: "primary",
        },
      ]}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          <Trans ns="admin:data">
            When you upload data to SeaSketch, the system creates a vector or
            raster tileset from the source upload. Sometimes it is desireable to
            build your own custom tileset as a replacement. For example, some
            global datasets may be too large to render in full detail within the
            limits of our hosted tiling system. You may want to use your
            workstation to create a full resolution tilese, which may take hours
            or days of processing.
          </Trans>
        </p>
        <p className="text-sm">
          <Trans ns="admin:data">
            It is your responsibilty to ensure the tileset being uploaded is
            based on the same uploaded vector or raster source. Otherwise there
            will be inconsistencies between data for download or analysis and
            what is presented on the map. Tilesets must be a{" "}
            <a
              className="text-primary-500"
              href="https://github.com/protomaps/PMTiles"
              target="_blank"
            >
              PMTiles
            </a>{" "}
            archive which contains a single layer.
          </Trans>
        </p>
      </div>
    </Modal>
  );
}
