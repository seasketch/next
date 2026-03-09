import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { Children, isValidElement } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import {
  DraftTableOfContentsDocument,
  useCopyDataLibraryTemplateMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { XIcon } from "@heroicons/react/outline";
import Spinner from "../../components/Spinner";
import useCurrentProjectMetadata from "../../useCurrentProjectMetadata";

export default function DataLibraryModal({
  onRequestClose,
  onOpenINaturalistModal,
}: {
  onRequestClose: () => void;
  onOpenINaturalistModal?: () => void;
}) {
  const metadata = useCurrentProjectMetadata();
  const { t } = useTranslation("admin:data");
  return (
    <Modal
      title={t("Data Library")}
      onRequestClose={onRequestClose}
      scrollable={false}
      zeroPadding
    >
      <button className="absolute right-3 top-3" onClick={onRequestClose}>
        <XIcon className="w-6 h-6   text-gray-600" />
      </button>
      <div className="flex flex-col max-h-144">
        <p className="text-sm flex-none px-6 border-b pb-4 shadow-md">
          <Trans ns="admin:data">
            These layers provided from authoritative sources do not count
            against your hosting quota, and come with preset cartography,
            metadata, and attribution. Data sources are updated regularly as
            provided by the original sources. Contact us at{" "}
            <a
              className="underline text-primary-500"
              href="mailto:support@seasketch.org"
            >
              support@seasketch.org
            </a>{" "}
            if you would like to add your data source to the list.
          </Trans>
        </p>
        <div className="space-y-2 pt-4 flex-1 overflow-y-auto p-6 bg-gray-100 overscroll-none">
          <DataLibraryEntry
            title={t("NOAA Coral Reef Watch")}
            href="https://coralreefwatch.noaa.gov/index.php"
          >
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

          <DataLibraryEntry
            title={t("iNaturalist")}
            href="https://www.inaturalist.org"
          >
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Create layers from iNaturalist observations, filtered by projects or specific taxa. Display observations as grids, points, or heatmaps."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t("iNaturalist logo")}
              src="/logos/inaturalist.png"
            />
            <DataLibraryCustomActionButton
              onClick={() => {
                onRequestClose();
                if (onOpenINaturalistModal) {
                  onOpenINaturalistModal();
                }
              }}
            />
          </DataLibraryEntry>

          <DataLibraryEntry
            title={t("Ecologically or Biologically Significant Marine Areas")}
            href="https://www.cbd.int/ebsa/about/background"
          >
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Special areas of the ocean which meet the Convention of Biological Diversity (CBD) science criteria."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t(
                "Ecologically or Biologically Significant Marine Areas thumbnail"
              )}
              src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/eff2c984-f9a9-471c-2347-cc8faaea1800/thumbnail"
            />
            <DataLibraryActionButton
              templateId="EBSA"
              onRequestClose={onRequestClose}
            />
          </DataLibraryEntry>

          <DataLibraryEntry
            title={t("Blue Habitats Seafloor Geomorphic Features")}
            href="https://bluehabitats.org/"
          >
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Global map of seafloor geomorphology, based on SRTM bathymetry grids."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t(
                "Blue Habitats Seafloor Geomorphic Features Map thumbnail"
              )}
              src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/cfa82d21-fcba-42a0-b738-ac697679df00/thumbnail"
            />
            <DataLibraryActionButton
              templateId="BLUE_HABITATS"
              onRequestClose={onRequestClose}
            />
          </DataLibraryEntry>

          <DataLibraryEntry
            title={t("Global Mangrove Watch")}
            href="https://www.globalmangrovewatch.org/"
          >
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Global mangrove distribution (1996-2020), based on SAR global mosaics."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t("Global Mangrove Watch thumbnail")}
              src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/49d18412-0d32-4d0c-d994-bf1f82bd6600/thumbnail"
            />
            <DataLibraryActionButton
              templateId="GLOBAL_MANGROVE_WATCH"
              onRequestClose={onRequestClose}
            />
          </DataLibraryEntry>

          <DataLibraryEntry
            title={t("Hydrothermal Vents")}
            href="https://doi.org/10.1594/PANGAEA.917894"
          >
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Comprehensive collection of active submarine hydrothermal vent fields."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t("Hydrothermal Vents thumbnail")}
              src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/0eae4d80-f196-4825-b16c-b0dacbd64100/thumbnail"
            />
            <DataLibraryActionButton
              templateId="HYDROTHERMAL_VENTS"
              onRequestClose={onRequestClose}
            />
          </DataLibraryEntry>

          <DataLibraryEntry
            title={t("Seamounts")}
            href="https://doi.org/10.1016/j.dsr.2011.02.004"
          >
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Global distribution of seamounts based on 30 arc seconds bathymetry data. Yesson et al., 2011."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t("Seamounts thumbnail")}
              src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/5ea9db69-523f-46fe-1557-f5ff5ababb00/thumbnail"
            />
            <DataLibraryActionButton
              templateId="SEAMOUNTS"
              onRequestClose={onRequestClose}
            />
          </DataLibraryEntry>

          <DataLibraryEntry
            title={t("Pristine Seas")}
            href="https://doi.org/10.1038/s41586-021-03371-z"
          >
            <DataLibraryEntryDescription>
              <p>
                {t(
                  "Prioritization of marine areas for biodiversity protection, boosting fisheries yield, and securing carbon stocks."
                )}
              </p>
            </DataLibraryEntryDescription>
            <DataLibraryEntryImage
              alt={t("Pristine Seas thumbnail")}
              src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/95947ba7-7062-42d1-6a7f-f37990723100/thumbnail"
            />
            <DataLibraryActionButton
              templateId="PRISTINE_SEAS"
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
  href,
}: {
  title: string;
  children?: React.ReactNode;
  href?: string;
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
    (child) =>
      isValidElement(child) &&
      (child.type === DataLibraryActionButton ||
        child.type === DataLibraryCustomActionButton)
  );
  return (
    <div className="flex border rounded p-4 bg-white shadow-sm">
      <div className="flex-1 space-y-1">
        <h4>{title}</h4>
        {description}
        <div className="space-x-2 pt-1">
          {actionButton}
          {href && (
            <a
              target="_blank"
              rel="noreferrer"
              href={href}
              className="text-primary-500 underline text-sm"
            >
              {t("source website")}
            </a>
          )}
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

function DataLibraryCustomActionButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("admin:data");
  return (
    <button
      onClick={onClick}
      className="text-sm rounded-full border border-blue-500 text-blue-800 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 inline-flex items-center space-x-1"
    >
      <span>{t("create layer")}</span>
      <PlusIcon />
    </button>
  );
}
