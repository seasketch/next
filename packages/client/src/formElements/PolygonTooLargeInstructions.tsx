import { Trans, useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import { formatSqKm } from "./maxPolygonSize";

/**
 * Explains how to shrink a polygon that is over the survey size limit.
 * Mirrors the self-intersection instructions respondents already see.
 */
export default function PolygonTooLargeInstructions({
  open,
  areaSqKm,
  maxSqKm,
  onRequestClose,
}: {
  open: boolean;
  areaSqKm: number;
  maxSqKm: number;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("surveys");
  if (!open) {
    return null;
  }
  const area = formatSqKm(areaSqKm);
  const max = formatSqKm(maxSqKm);
  return (
    <Modal
      icon="alert"
      title={t("Shape Too Large")}
      onRequestClose={onRequestClose}
      footer={[
        {
          variant: "primary",
          label: t("Okay"),
          onClick: onRequestClose,
        },
      ]}
    >
      <div className="space-y-3 text-sm text-gray-800 max-w-md">
        <p>
          <Trans ns="surveys">
            This polygon is {{ area }} km². It must be {{ max }} km² or smaller
            before you can continue.
          </Trans>
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <Trans ns="surveys">
              The shape stays red while it is over the limit. The minimap
              outline turns red too.
            </Trans>
          </li>
          <li>
            <Trans ns="surveys">
              Drag the corner points inward to shrink the shape. The size on
              the map updates as you drag.
            </Trans>
          </li>
          <li>
            <Trans ns="surveys">
              When the shape is small enough, the red highlight disappears and
              Done becomes available.
            </Trans>
          </li>
          <li>
            <Trans ns="surveys">
              You can also delete this shape and draw a smaller one.
            </Trans>
          </li>
        </ol>
      </div>
    </Modal>
  );
}
