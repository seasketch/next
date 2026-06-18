/* eslint-disable i18next/no-literal-string */
import { ReactNode } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  RocketIcon,
  UploadIcon,
  MagicWandIcon,
  LockClosedIcon,
  FileTextIcon,
  GlobeIcon,
  ArrowLeftIcon,
} from "@radix-ui/react-icons";

export const mapPortalHostingUseCase = {
  id: "map-portal-hosting",
  to: "/uses/map-portal-hosting",
  title: "Map Portal Hosting",
  navLabel: "Map Portal Hosting",
  readMoreLabel: "Read more about Map Portal Hosting",
  summary:
    "Host, visualize, and share spatial data. Create a common picture of your ocean environment.",
  bullets: [
    "Host vector and raster data",
    "Design approachable maps for stakeholders",
    "Manage metadata, versions, and access",
  ],
};

const supportedFormats = [
  "GeoJSON",
  "Shapefile (.zip)",
  "GeoTIFF",
  "NetCDF",
  "FlatGeobuf",
];

type FeatureRowProps = {
  reverse?: boolean;
  eyebrow: string;
  icon: ReactNode;
  title: string;
  image: string;
  imageAlt: string;
  glowClassName: string;
  rowClassName?: string;
  imageContainerClassName?: string;
  children: ReactNode;
};

function FeatureRow({
  reverse,
  eyebrow,
  icon,
  title,
  image,
  imageAlt,
  glowClassName,
  rowClassName,
  imageContainerClassName,
  children,
}: FeatureRowProps) {
  return (
    <div
      className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${
        rowClassName ?? ""
      }`}
    >
      <div className={reverse ? "md:order-2" : ""}>
        <div className={`group relative ${imageContainerClassName ?? ""}`}>
          <div
            aria-hidden
            className={`absolute -inset-6 rounded-[2.5rem] ${glowClassName} opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-90`}
          />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl ring-1 ring-black/10">
            <img src={image} alt={imageAlt} loading="lazy" className="w-full" />
          </div>
        </div>
      </div>
      <div className={reverse ? "md:order-1" : ""}>
        <div className="inline-flex items-center gap-2 text-sky-600">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
            {icon}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">
            {eyebrow}
          </span>
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {title}
        </h2>
        <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MapPortalHostingPage() {
  return (
    <main className="bg-slate-950 text-slate-100">
      <Helmet>
        <title>{`SeaSketch | ${mapPortalHostingUseCase.title}`}</title>
        <link
          rel="canonical"
          href={`https://www.seasketch.org${mapPortalHostingUseCase.to}`}
        />
      </Helmet>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/25 blur-3xl" />
          <div className="absolute top-10 right-0 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(56,189,248,0.12),transparent)]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pt-16">
          <Link
            to="/#use-cases"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to SeaSketch capabilities
          </Link>

          <div className="mt-10 max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300/90">
              Map Portal Hosting
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
              Publish a{" "}
              <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                living map
              </span>{" "}
              of your ocean
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Host, visualize, and share spatial data in a fast, easy-to-use map
              portal. Bring fragmented datasets together into a single common
              picture of your ocean environment, accessible to your whole team
              and the public.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/new-project"
                className="inline-flex items-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
              >
                Create a project
              </a>
              <a
                href="mailto:support@seasketch.org"
                className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/10"
              >
                Request a demo
              </a>
            </div>
          </div>

          <div className="relative mt-14">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-tr from-sky-500/20 via-cyan-400/10 to-emerald-400/20 blur-3xl"
            />
            <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl ring-1 ring-white/10">
              <img
                src="/uses/map-portal-hero-2.png"
                alt="The Te Baiku Ocean Geodatabase in SeaSketch showing geomorphic reef features for Kiribati with a map legend"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature rows */}
      <section className="relative rounded-t-[2.5rem] bg-gradient-to-b from-white to-slate-100 pt-16 text-slate-900 lg:pt-24">
        <div className="mx-auto max-w-6xl space-y-20 px-4 pb-20 sm:px-6 lg:space-y-28 lg:px-8 lg:pb-28">
          <FeatureRow
            eyebrow="Performance"
            icon={<RocketIcon className="h-5 w-5" />}
            title="Fast, beautiful maps"
            image="/uses/outer-reef-flat-square.png"
            imageAlt="A SeaSketch reef habitat map with an Outer Reef Flat tooltip appearing instantly under the cursor"
            glowClassName="bg-sky-400/25"
            rowClassName="md:grid-cols-[auto_1fr] md:gap-8 lg:gap-10"
            imageContainerClassName="mx-auto w-64 sm:w-72"
          >
            <p>
              One of the first things people notice is how quickly maps load on
              SeaSketch. Your spatial data is transformed into static map tiles
              and distributed over a global content delivery network for the
              best possible performance, anywhere in the world.
            </p>
            <p>
              Vector tiles power instant interactivity such as popups, tooltips,
              and hover effects respond immediately as users explore.{" "}
              <span className="font-semibold text-slate-900">
                No more loading spinners.
              </span>
            </p>
          </FeatureRow>

          <FeatureRow
            reverse
            eyebrow="Out of the box efficiency"
            icon={<UploadIcon className="h-5 w-5" />}
            title="Create a map portal in minutes"
            image="/uses/drag-and-drop-data.png"
            imageAlt="Dragging and dropping geospatial data files into a SeaSketch project"
            glowClassName="bg-emerald-400/25"
          >
            <p>
              SeaSketch projects are free to create and include hosting for up
              to 10&nbsp;GB of spatial data. Just drag and drop your files into
              the project and SeaSketch handles optimizing them for the web,
              with tiling, compression, and styling included.
            </p>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Supported formats
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {supportedFormats.map((format) => (
                  <span
                    key={format}
                    className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                  >
                    {format}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Need another format?{" "}
                <a
                  href="mailto:support@seasketch.org"
                  className="font-medium text-sky-700 hover:underline"
                >
                  Let us know
                </a>
                .
              </p>
            </div>
          </FeatureRow>

          <FeatureRow
            eyebrow="Cartography"
            icon={<MagicWandIcon className="h-5 w-5" />}
            title="Style layers with AI and graphical cartography tools"
            image="/uses/cartography-gui.png"
            imageAlt="Graphical cartography panel with color palette, opacity, and AI style suggestions"
            glowClassName="bg-cyan-400/30"
          >
            <p>
              When you upload a layer, SeaSketch can use AI to suggest a title,
              attribution, and an appropriate cartographic style, so your data
              looks great from the moment it lands.
            </p>
            <p>
              Fine-tune everything with the graphical cartography tools: adjust
              color palettes, opacity, labels, and interactivity options without
              writing a single line of code.
            </p>
          </FeatureRow>

          <FeatureRow
            reverse
            eyebrow="Governance"
            icon={<LockClosedIcon className="h-5 w-5" />}
            title="Powerful data governance"
            image="/uses/data-governance.png"
            imageAlt="Changelog activity feed alongside a role-based access control panel"
            glowClassName="bg-indigo-400/25"
          >
            <p>
              Role-based access control lets you share layers with specific user
              groups and decide whether raw data download is enabled.
              Administrators collaborate on a draft layer list together, then
              publish final changes to the public when they&rsquo;re ready.
            </p>
            <p>
              A complete changelog tracks every update made by project
              administrators. In a large, collaboratively managed project, you
              always know who changed what, and when. You can even rollback
              certain changes like cartographic styles.
            </p>
          </FeatureRow>
        </div>
      </section>

      {/* Secondary feature strip */}
      <section className="bg-slate-100 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                <FileTextIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                Metadata &amp; version management
              </h3>
              <p className="mt-3 leading-7 text-slate-600">
                Keep authoritative metadata attached to every layer and track
                changes to your spatial data over time, so your team always
                works from a trusted, well-documented source of truth.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                <GlobeIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                Integrates with Esri &amp; open-source services
              </h3>
              <p className="mt-3 leading-7 text-slate-600">
                For data you&rsquo;d rather not host on SeaSketch, link directly
                to layers from ArcGIS Online, ArcGIS Enterprise, or a range of
                OGC services, and blend them seamlessly into your portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative isolate overflow-hidden bg-slate-950">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -top-24 right-1/4 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Ready to publish your ocean data?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Spin up a free project and build a fast, beautiful map portal in an
            afternoon.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/new-project"
              className="inline-flex items-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            >
              Create a project
            </a>
            <a
              href="mailto:support@seasketch.org"
              className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/10"
            >
              Talk to our team
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
