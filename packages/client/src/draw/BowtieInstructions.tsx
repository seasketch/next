import { useRef } from "react";
import { useTranslation, Trans } from "react-i18next";
import Modal from "../components/Modal";
// @ts-ignore
import url from "./bowtie.mp4";

export default function BowtieInstructions({
  open,
  onRequestClose,
  onRequestReset,
}: {
  open: boolean;
  onRequestClose?: () => void;
  onRequestReset?: () => void;
}) {
  const { t } = useTranslation("digitizing");
  const videoRef = useRef<HTMLVideoElement>(null);
  return !open ? null : (
    <Modal
      zeroPadding
      autoWidth
      title={t("Invalid Shape")}
      onRequestClose={onRequestClose || (() => {})}
      footer={
        [
          {
            variant: "primary",
            label: t("Okay"),
            onClick: onRequestClose,
          },
          ...(onRequestReset && onRequestClose
            ? [
                {
                  label: t("Reset Shape"),
                  onClick: () => {
                    onRequestReset();
                    onRequestClose();
                  },
                },
              ]
            : []),
        ]
        // <div className="flex justify-end space-x-1 rtl:space-x-reverse">
        //   {onRequestReset && onRequestClose && (
        //     <Button
        //       label={t("Reset Shape")}
        //       onClick={() => {
        //         onRequestReset();
        //         onRequestClose();
        //       }}
        //     />
        //   )}
        //   <Button
        //     primary
        //     autofocus
        //     className=""
        //     label={t("Okay")}
        //     onClick={onRequestClose}
        //   />
        // </div>
      }
    >
      <div className="w-96 max-w-full">
        <div
          className="flex justify-center"
          style={{ backgroundColor: "rgb(117, 207, 240)" }}
        >
          <video
            playsInline
            ref={videoRef}
            autoPlay={true}
            src={url}
            loop
            width="257"
          />
        </div>
        <p className="p-5">
          <Trans ns="digitizing" i18nKey="InvalidShapeInstructions">
            Your shape will turn red if invalid. When this happens make sure
            your shape does not cross itself, as indicated by the X symbols. If
            you continue to have trouble, consider deleting your shape and
            starting over.
          </Trans>
        </p>
      </div>
    </Modal>
  );
}
