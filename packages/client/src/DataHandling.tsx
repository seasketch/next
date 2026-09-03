/* eslint-disable i18next/no-literal-string */
import {
  LeadItem,
  LeadList,
  LegalPageLayout,
  P,
  SectionHeading,
  SubHeading,
  TextLink,
} from "./components/LegalPageComponents";

const LAST_UPDATED = "September 3, 2026";

interface Subprocessor {
  name: string;
  url: string;
  purpose: string;
  data: string;
  location: string;
}

const subprocessors: Subprocessor[] = [
  {
    name: "Amazon Web Services",
    url: "https://d1.awsstatic.com/legal/aws-gdpr/AWS_GDPR_DPA.pdf",
    purpose:
      "Cloud hosting. Runs our primary database, application servers, data processing pipeline, file storage, and transactional email delivery (Amazon SES).",
    data: "All application data: account information, projects, sketches, survey responses, forum posts, and uploaded datasets.",
    location: "USA — Oregon",
  },
  {
    name: "Cloudflare",
    url: "https://www.cloudflare.com/cloudflare-customer-dpa/",
    purpose:
      "Content delivery network and edge hosting. Serves the SeaSketch web application, hosted map tiles and data files (R2 object storage), and images. Also provides privacy-preserving web analytics and the AI Gateway proxy described below.",
    data: "Uploaded spatial data and derived map tiles, user images (profile pictures, forum attachments, map screenshots), and aggregate traffic analytics.",
    location: "Global edge network (Cloudflare, Inc., USA)",
  },
  {
    name: "Auth0 (Okta)",
    url: "https://www.okta.com/agreements/",
    purpose: "User authentication and identity management.",
    data: "Email address, name, profile picture, and login credentials.",
    location: "USA",
  },
  {
    name: "Sentry",
    url: "https://sentry.io/legal/dpa/",
    purpose:
      "Error and performance monitoring, used to detect and fix software problems.",
    data: "Error reports and diagnostic traces, which may include your account email, user ID, IP address, and browser details.",
    location: "USA",
  },
  {
    name: "OpenAI",
    url: "https://openai.com/enterprise-privacy/",
    purpose:
      "Optional AI-assisted metadata suggestions when administrators upload spatial datasets (suggested titles, attribution formatting, and cartographic settings). These features run only after a clear description of what will be shared and explicit user consent. Requests are routed through Cloudflare AI Gateway rather than sent directly.",
    data: "Dataset filenames and summarized layer statistics only, with automated redaction of columns that appear to contain personal information applied before anything is sent. API data is not used to train OpenAI models.",
    location: "USA",
  },
  {
    name: "Mapbox",
    url: "https://www.mapbox.com/legal/privacy",
    purpose: "Basemap rendering and map tile services.",
    data: "Map tile requests, including IP address and the map area being viewed.",
    location: "USA",
  },
  {
    name: "Google Maps Platform",
    url: "https://cloud.google.com/terms/data-processing-addendum",
    purpose: "Satellite basemap imagery on some pages.",
    data: "Map tile requests, including IP address and the map area being viewed.",
    location: "USA / global",
  },
  {
    name: "Unsplash",
    url: "https://unsplash.com/privacy",
    purpose:
      "Background image search when administrators design surveys and landing pages.",
    data: "Image search queries entered by project administrators.",
    location: "USA",
  },
  {
    name: "Slack",
    url: "https://slack.com/trust/privacy/privacy-policy",
    purpose:
      "Internal operations alerting for the SeaSketch team, such as notification of failed data upload processing.",
    data: "Alerts may include dataset filenames and the account identifier of the user who initiated the failed operation.",
    location: "USA",
  },
];

export default function DataHandling() {
  return (
    <LegalPageLayout
      title="Data Handling & Sub-processors"
      lastUpdated={LAST_UPDATED}
    >
      <div className="mt-6 space-y-4 text-base leading-7 text-gray-600">
        <p>
          This page describes the third-party services
          (&ldquo;sub-processors&rdquo;) SeaSketch uses to operate, what data
          each handles, where data is processed, and how data is protected at
          rest and in transit. It is intended for partners, agencies, and
          institutions conducting due diligence. It supplements our{" "}
          <TextLink href="/privacy-policy">Privacy Policy</TextLink> and{" "}
          <TextLink href="/terms-of-use">Terms of Use</TextLink>.
        </p>
        <p>
          SeaSketch is open-source software operated by the SeaSketch team at
          the University of California Santa Barbara. The source code, including
          the infrastructure configuration referenced on this page, can be
          viewed at{" "}
          <TextLink href="https://github.com/seasketch/next" external>
            github.com/seasketch/next
          </TextLink>
          .
        </p>
      </div>

      <SectionHeading id="subprocessors">Sub-processors</SectionHeading>
      <p className="mt-3 text-base leading-7 text-gray-600">
        We use the following service providers to deliver SeaSketch. Data shared
        with each provider is governed by their respective data processing
        agreements, linked below.
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Service
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Purpose
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Data involved
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Location
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {subprocessors.map((s) => (
              <tr key={s.name} className="align-top">
                <td className="whitespace-nowrap px-4 py-4 font-medium">
                  <TextLink href={s.url} external>
                    {s.name}
                  </TextLink>
                </td>
                <td className="px-4 py-4 leading-6 text-gray-600">
                  {s.purpose}
                </td>
                <td className="px-4 py-4 leading-6 text-gray-600">{s.data}</td>
                <td className="px-4 py-4 leading-6 text-gray-600">
                  {s.location}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeading>Where your data lives</SectionHeading>
      <LeadList>
        <LeadItem label="Primary database.">
          All core application data (accounts, projects, sketches, survey
          responses, forum posts) lives in a PostgreSQL database hosted on
          Amazon RDS in the AWS us-west-2 (Oregon) region.
        </LeadItem>
        <LeadItem label="Uploaded spatial data.">
          Datasets uploaded by project administrators are processed in AWS
          us-west-2 and hosted for map display on Cloudflare R2 object storage,
          served from Cloudflare&rsquo;s global edge network so maps load
          quickly around the world.
        </LeadItem>
        <LeadItem label="Images.">
          Profile pictures, forum image attachments, and map screenshots are
          stored on Cloudflare Images.
        </LeadItem>
        <LeadItem label="Identity.">
          Login credentials are managed by Auth0 and are never stored on
          SeaSketch servers.
        </LeadItem>
      </LeadList>

      <SectionHeading>Encryption</SectionHeading>
      <SubHeading>In transit</SubHeading>
      <P>
        All connections between your browser and SeaSketch, and between
        SeaSketch services and our sub-processors, are encrypted using TLS
        (HTTPS).
      </P>
      <SubHeading>At rest</SubHeading>
      <LeadList>
        <LeadItem label="Database.">
          Our PostgreSQL database uses AWS storage-level encryption (AES-256).
          Automated backups, retained for 30 days, are likewise encrypted.
        </LeadItem>
        <LeadItem label="File storage.">
          Objects in AWS S3 are encrypted at rest with server-side encryption
          (SSE-S3, AES-256). Objects in Cloudflare R2 and Cloudflare Images are
          encrypted at rest by the Cloudflare platform (AES-256).
        </LeadItem>
        <LeadItem label="Credentials and secrets.">
          Service credentials are stored in AWS Secrets Manager, encrypted at
          rest, and database master credentials are automatically rotated every
          30 days.
        </LeadItem>
        <LeadItem label="Caches.">
          A short-lived cache supports API performance and rate limiting. It
          runs within a private network that is not accessible from the internet
          and does not durably store user content.
        </LeadItem>
      </LeadList>

      <SectionHeading>AI features</SectionHeading>
      <p className="mt-3 text-base leading-7 text-gray-600">
        SeaSketch uses a large language model (OpenAI, accessed through
        Cloudflare AI Gateway) for a narrow purpose: suggesting titles,
        attribution, and cartographic settings when project administrators
        upload spatial datasets. These AI features are optional and run only
        after a clear description of what will be shared and explicit user
        consent; no data is ever sent to AI providers automatically. When used,
        only dataset filenames and summarized layer statistics are sent, and
        columns that appear to contain personal information are automatically
        redacted before the request is made. Survey responses, sketches, forum
        posts, and account information are never sent to AI providers. Data
        submitted through the OpenAI API is not used to train their models.
      </p>

      <SectionHeading>Retention and deletion</SectionHeading>
      <p className="mt-3 text-base leading-7 text-gray-600">
        To delete your account or a project you own, contact us at{" "}
        <TextLink href="mailto:support@seasketch.org">
          support@seasketch.org
        </TextLink>
        . Once deleted, the associated content is removed within 30 days,
        including from backups. See our{" "}
        <TextLink href="/privacy-policy">Privacy Policy</TextLink> for details.
      </p>

      <SectionHeading>Changes to this page</SectionHeading>
      <p className="mt-3 text-base leading-7 text-gray-600">
        This page is maintained in our open-source repository, and its full
        revision history is available{" "}
        <TextLink
          href="https://github.com/seasketch/next/commits/master/packages/client/src/DataHandling.tsx"
          external
        >
          on GitHub
        </TextLink>
        . When we add or change a sub-processor we will update this page and
        refresh the date at the top. If your organization requires advance
        notice of sub-processor changes or has due-diligence questions, contact
        us at{" "}
        <TextLink href="mailto:support@seasketch.org">
          support@seasketch.org
        </TextLink>{" "}
        and we will accommodate your review process.
      </p>
    </LegalPageLayout>
  );
}
