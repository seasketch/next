import { useHistory, useParams } from "react-router-dom";
import Button from "../../../components/Button";
import InputBlock from "../../../components/InputBlock";
import ProgressBar from "../../../components/ProgressBar";
import Switch from "../../../components/Switch";
import { useTranslation, Trans } from "react-i18next";
import useProjectId from "../../../useProjectId";
import {
  ArcGISServiceSettings,
  LayerInfo,
  MapServerCatalogInfo,
  MapServerImageFormat,
  useImportArcGISService,
} from "./arcgis";
import Modal from "../../../components/Modal";

export default function DynamicMapServerSettingsForm(props: {
  settings: ArcGISServiceSettings;
  serviceRoot: string;
  updateSettings: (settings: ArcGISServiceSettings) => void;
  layerInfo: LayerInfo[];
  mapServerInfo: MapServerCatalogInfo;
}) {
  const { settings, updateSettings } = props;
  const [importService, importServiceState] = useImportArcGISService(
    props.serviceRoot
  );
  const { slug } = useParams<{ slug: string }>();
  const projectId = useProjectId();
  const history = useHistory();
  const { t } = useTranslation("admin");
  const acceptableImageFormats = [
    "PNG",
    "PNG8",
    "PNG24",
    "PNG32",
    "GIF",
    "JPG",
  ];
  return (
    <div>
      <InputBlock
        title={t("Enable High-DPI Requests")}
        className="mt-4 text-sm"
        input={
          <Switch
            isToggled={settings.enableHighDpi}
            onClick={() =>
              updateSettings({
                ...settings,
                enableHighDpi: !settings.enableHighDpi,
              })
            }
          />
        }
      >
        <Trans ns="admin">
          Request higher resolution images when the user has a "Retina" or 4k
          display. Maps will be much more detailed, but it demands more of the
          data server.
        </Trans>
      </InputBlock>
      <InputBlock
        className="mt-4 text-sm"
        title={t("Image Format")}
        input={
          <select
            id="imageFormat"
            className="form-select block w-full pl-3 pr-4 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
            value={settings.imageFormat}
            onChange={(e) => {
              updateSettings({
                ...settings,
                imageFormat: e.target.value as MapServerImageFormat,
              });
            }}
          >
            {acceptableImageFormats.map((f) => (
              <option key={f} value={f}>
                {f.toLocaleLowerCase()}
              </option>
            ))}
          </select>
        }
      >
        <Trans ns="admin">
          Imagery data looks best using <code>jpg</code>, for others{" "}
          <code>png</code> is a good choice.
        </Trans>
      </InputBlock>
      {/* <InputBlock
        className="mt-4 text-sm"
        title="Rendering order"
        input={
          <select
            id="renderUnder"
            className="form-select block w-full pl-3 pr-8 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
            value={settings.renderUnder}
            onChange={(e) => {
              updateSettings({
                ...settings,
                renderUnder: e.target.value as RenderUnderType,
              });
            }}
          >
            <option value={"NONE"}>Cover basemap</option>
            <option value={"LABELS"}>Under labels</option>
          </select>
        }
      >
        If your basemaps are configured to identify these special layers, you
        can render this service underneath labels or land.
      </InputBlock> */}
      <div className="mt-6 mb-5 bg-gray-100 rounded py-2 px-4 pb-3">
        <h3 className="font-medium">{t("Import Service")}</h3>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          <Trans ns="admin">
            Please review the layer list and exclude any that you do not wish to
            display, and check that the above settings render well.
          </Trans>
        </p>
        <Button
          primary={true}
          label={t(`Import Service`)}
          onClick={async () => {
            await importService(
              props.layerInfo,
              props.mapServerInfo,
              projectId!,
              settings,
              "image"
            );
            if (!importServiceState.error) {
              history.push(`/${slug}/admin/data`);
            }
          }}
        />
      </div>
      {(!!importServiceState.inProgress || !!importServiceState.error) && (
        <Modal
          autoWidth
          title={t("Import Image Service")}
          onRequestClose={() => {}}
        >
          <div className="w-128">
            {importServiceState.error && (
              <>
                <div className="mb-2 mt-4 text-red-900">
                  <h4>{importServiceState.error.name}</h4>
                  {importServiceState.error.message}
                </div>
                <Button
                  onClick={() => history.push(`/${slug}/admin/data`)}
                  label={t("Cancel")}
                  className="mr-2"
                />
              </>
            )}
            {importServiceState.inProgress && (
              <div>
                <ProgressBar progress={importServiceState.progress!} />
                <div className="mb-2 text-sm">
                  {importServiceState.statusMessage}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
