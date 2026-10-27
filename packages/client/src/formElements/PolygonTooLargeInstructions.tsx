import { Trans, useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import { PolygonTooLargeNotice } from "./MaxPolygonSizeSetting";

/**
 * Same dialog shell as the self-intersection instructions.
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
  return (
    <Modal
      zeroPadding
      autoWidth
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
      <div className="w-96 max-w-full">
        <p className="p-5">
          <PolygonTooLargeNotice areaSqKm={areaSqKm} maxSqKm={maxSqKm} />{" "}
          <Trans ns="surveys">
            Your shape stays red while it is over the limit. Drag the points
            inward until the red highlight goes away and you can continue. If
            you continue to have trouble, delete the shape and draw a smaller
            one.
          </Trans>
        </p>
      </div>
    </Modal>
  );
}
