import { ReactNode, useState } from "react";
import { UserGroupIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useProjectMetadataQuery } from "../generated/graphql";
import logo from "../header/seasketch-logo.png";
import Modal from "./Modal";
import {
  ProjectContact,
  SEASKETCH_SUPPORT_EMAIL,
  mailtoHref,
} from "./contactEmail";

/**
 * Opens a choice between the project administrator and SeaSketch support.
 * Outside a project, or before that address is known, it is a direct mailto
 * to the SeaSketch team.
 */
export default function ContactChooser(props: {
  children: ReactNode;
  className?: string;
  tabIndex?: number;
  role?: string;
  subject?: string;
  /**
   * Pass the project when it is already loaded, including on routes that do
   * not have a :slug param. Omit it to use the project in the current URL.
   */
  project?: ProjectContact;
}) {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug;
  const discover = props.project === undefined;
  const { data } = useProjectMetadataQuery({
    variables: { slug: slug || "" },
    skip: !discover || !slug,
  });
  const discovered = projectContact(
    data?.project?.name || data?.projectPublicDetails?.name,
    data?.project?.supportEmail || data?.projectPublicDetails?.supportEmail
  );
  const project = props.project || discovered;
  const [open, setOpen] = useState(false);

  return (
    <>
      <a
        href={mailtoHref(SEASKETCH_SUPPORT_EMAIL, props.subject)}
        className={props.className}
        tabIndex={props.tabIndex}
        role={props.role}
        onClick={(event) => {
          if (!project) {
            return;
          }
          event.preventDefault();
          setOpen(true);
        }}
      >
        {props.children}
      </a>
      {open && project && (
        <ContactChooserModal
          project={project}
          subject={props.subject}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function ContactChooserModal(props: {
  project: ProjectContact;
  subject?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const projectName = props.project.name;
  return (
    <Modal
      title={t("Who would you like to contact?")}
      onRequestClose={props.onClose}
      scrollable
      footer={[{ label: t("Cancel"), onClick: props.onClose }]}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ContactCard
          href={mailtoHref(props.project.email, props.subject)}
          title={t("Project administrator")}
          email={props.project.email}
          action={t("Email project administrator")}
          icon={
            <UserGroupIcon className="h-6 w-6" aria-hidden="true" />
          }
          tone="project"
          onClick={props.onClose}
        >
          <Trans ns="common">
            Use this address for questions about{" "}
            <strong className="font-semibold text-gray-900">
              {{ projectName }}
            </strong>
            , including access requests, questions or comments about data, and
            information about the objectives of the project.
          </Trans>
        </ContactCard>
        <ContactCard
          href={mailtoHref(SEASKETCH_SUPPORT_EMAIL, props.subject)}
          title={t("SeaSketch support")}
          email={SEASKETCH_SUPPORT_EMAIL}
          action={t("Email SeaSketch support")}
          icon={
            <img src={logo} alt="" className="h-7 w-7" />
          }
          tone="software"
          onClick={props.onClose}
        >
          <Trans ns="common">
            Contact the SeaSketch development team about bugs, outages,
            technical questions, and for help with using the software.
          </Trans>
        </ContactCard>
      </div>
    </Modal>
  );
}

function ContactCard(props: {
  href: string;
  title: string;
  email: string;
  action: string;
  icon: ReactNode;
  tone: "project" | "software";
  onClick: () => void;
  children: ReactNode;
}) {
  const iconClass =
    props.tone === "project"
      ? "bg-primary-300 bg-opacity-20 text-primary-700"
      : "bg-gray-100 text-gray-700";
  const buttonClass =
    props.tone === "project"
      ? "border-transparent bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500"
      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus:ring-primary-500";
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 text-left shadow-sm ${
        props.tone === "project" ? "border-primary-300" : "border-gray-200"
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}
      >
        {props.icon}
      </span>
      <span className="mt-3 text-base font-semibold text-gray-900">
        {props.title}
      </span>
      <span className="mt-1 break-all text-sm font-medium text-primary-700">
        {props.email}
      </span>
      <span className="mt-2 flex-1 text-sm leading-5 text-gray-600">
        {props.children}
      </span>
      <a
        href={props.href}
        onClick={props.onClick}
        className={`mt-4 inline-flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonClass}`}
      >
        {props.action}
      </a>
    </div>
  );
}

function projectContact(
  name: string | null | undefined,
  email: string | null | undefined
): ProjectContact | undefined {
  if (!name || !email) {
    return undefined;
  }
  return { name, email };
}
