import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { Children, isValidElement } from "react";
import Button from "../../components/Button";
import { PlusIcon } from "@radix-ui/react-icons";
import {
  DraftTableOfContentsDocument,
  useCopyDataLibraryTemplateMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { XIcon } from "@heroicons/react/outline";
import Spinner from "../../components/Spinner";

export default function DataLibraryModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  return (
    <Modal title={t("Data Library")} onRequestClose={onRequestClose}>
      <button onClick={onRequestClose}>
        <XIcon className="w-6 h-6 absolute right-3 top-3 text-gray-600" />
      </button>
      <div>
        <p className="text-sm">
          <Trans ns="admin:data">
            The SeaSketch team is in the process of creating a curated
            collection of data from authoritative sources. These layers do not
            count against your hosting quota, and come with preset cartography,
            metadata, and attribution. Data sources are updated regularly as
            provided by the original sources.
          </Trans>
        </p>
        <p className="text-sm">
          <Trans ns="admin:data">
            This list of layers will grow over time. If you are a data provider
            who would like your project listed, please contact us at{" "}
            <a
              className="underline text-primary-500"
              href="mailto:support@seasketch.org"
            >
              support@seasketch.org
            </a>
          </Trans>
        </p>
        <div className="space-y-2 pt-4">
          <DataLibraryEntry title={t("NOAA Coral Reef Watch")}>
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Indicators of coral bleaching and heat stress for coral reefs globally, developed using remote sensing data. Updated daily."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t("Coral Reef Watch gauge example")}
              src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/9c11e418-b4a5-445e-0b67-cb026a875400/thumbnail"
            />
            <DataLibraryActionButton
              templateId="CRW_ROOT"
              onRequestClose={onRequestClose}
            />
          </DataLibraryEntry>
        </div>
      </div>
    </Modal>
  );
}

function DataLibraryEntry({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation("admin:data");
  // get DataLIbraryEntryImage from children, if present
  const img = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === DataLibraryEntryImage
  );
  const description = Children.toArray(children).find(
    (child) =>
      isValidElement(child) && child.type === DataLibraryEntryDescription
  );
  const actionButton = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === DataLibraryActionButton
  );
  return (
    <div className="flex border rounded p-2">
      <div className="flex-1 space-y-1">
        <h4>{title}</h4>
        {description}
        <div className="space-x-2 pt-1">
          {actionButton}
          {/* <Button small primary label= /> */}
          <a
            target="_blank"
            href="https://coralreefwatch.noaa.gov/index.php"
            className="text-primary-500 underline text-sm"
          >
            {t("source website")}
          </a>
        </div>
      </div>
      <div className="flex w-32 items-center justify-center">
        {img || "No image. Add a <DataLibraryEntryImage />"}
      </div>
    </div>
  );
}

function DataLibraryEntryImage({ src, alt }: { src: string; alt: string }) {
  return <img alt={alt} src={src} />;
}

function DataLibraryEntryDescription({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="text-sm">{children}</div>;
}

function DataLibraryActionButton({
  templateId,
  onRequestClose,
}: {
  templateId: string;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const [copyTemplate, copyTemplateState] = useCopyDataLibraryTemplateMutation({
    onCompleted: onRequestClose,
    variables: {
      slug: getSlug(),
      templateId,
    },
    onError,
    refetchQueries: [DraftTableOfContentsDocument],
    awaitRefetchQueries: true,
  });
  return (
    <button
      onClick={() => copyTemplate()}
      disabled={copyTemplateState.loading}
      className={`text-sm rounded-full border  px-2 ${
        copyTemplateState.loading
          ? "border-gray-500 text-gray-800 bg-gray-100 cursor-wait"
          : "border-blue-500 text-blue-800 bg-blue-100 hover:bg-blue-200"
      } py-0.5 inline-flex items-center space-x-1`}
    >
      <span>{t("add to project")}</span>
      {copyTemplateState.loading ? <Spinner mini /> : <PlusIcon />}
    </button>
  );
}
