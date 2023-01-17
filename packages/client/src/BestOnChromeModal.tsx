import { useUserAgent } from "@oieduardorabelo/use-user-agent";
import { Trans, useTranslation } from "react-i18next";
import Modal from "./components/Modal";
import useSessionStorage from "./useSessionStorage";

export default function BestOnChromeModal() {
  let details = useUserAgent();
  const { t } = useTranslation("homepage");
  const [dismissed, setDismissed] = useSessionStorage<boolean>(
    "best-on-chrome-dismissed",
    false
  );
  if (details?.browser?.name !== "Chrome" && !dismissed) {
    const onRequestClose = () => setDismissed(true);
    return (
      <Modal
        title={t("Please use Google Chrome")}
        onRequestClose={onRequestClose}
        footer={[
          {
            label: t("Close"),
            onClick: onRequestClose,
          },
        ]}
      >
        <p className="pb-2">
          <Trans ns="homepage">
            This is a little embarrasing, but our newest version of SeaSketch
            isn't ready for use in your preferred browser. Please{" "}
            <a
              className="text-primary-500 underline"
              href="https://www.google.com/chrome/"
            >
              download Google Chrome
            </a>{" "}
            for use with SeaSketch.
          </Trans>
        </p>
        <p>
          <Trans ns="homepage">
            We'll be adding support for this browser in the coming weeks.
          </Trans>
        </p>
      </Modal>
    );
  } else {
    return null;
  }
}
