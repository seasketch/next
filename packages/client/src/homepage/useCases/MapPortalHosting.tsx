/* eslint-disable i18next/no-literal-string */
import { BookOpenIcon } from "@heroicons/react/outline";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  RocketIcon,
  UploadIcon,
  MagicWandIcon,
  LockClosedIcon,
  FileTextIcon,
  GlobeIcon,
  ArrowLeftIcon,
  ChatBubbleIcon,
  LayersIcon,
} from "@radix-ui/react-icons";
import { mapPortalHostingUseCase } from "./useCaseDefs";
import UseCaseHelmet from "./UseCaseHelmet";
import { cloudflareImage } from "./cloudflareImages";

const MAP_PORTAL_HERO_IMAGE = cloudflareImage(
  "af4df994-3ed3-4c4a-15f0-1c327eba1200",
  "hlarge"
);

const featureCopyPanelClass =
  "relative z-20 rounded-2xl border border-white/60 bg-white/65 p-5 shadow-sm backdrop-blur-sm md:p-6";

const supportedFormats = [
  "GeoJSON",
  "Shapefile (.zip)",
  "GeoTIFF",
  "NetCDF",
  "FlatGeobuf",
];

type AdditionalFeatureCard = {
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
};

const additionalFeatureCards: AdditionalFeatureCard[] = [
  {
    title: "Metadata management",
    description:
      "Author and maintain metadata for your layers as rich text documents managed directly in SeaSketch, or upload data with XML metadata using standard formats.",
    icon: <FileTextIcon className="h-5 w-5" />,
    iconClassName: "bg-sky-100 text-sky-700 ring-sky-200",
  },
  {
    title: "Integrates with Esri & open-source services",
    description:
      "For data already hosted elsewhere, link directly to services on ArcGIS Online or ArcGIS Enterprise. You can also add vector tiles and live GeoJSON data sources.",
    icon: <GlobeIcon className="h-5 w-5" />,
    iconClassName: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  {
    title: "Data library",
    description:
      "Browse a growing library of authoritative datasets curated for ocean planning, then add them with preconfigured cartography and metadata plus source-linked updates over time.",
    icon: <BookOpenIcon className="h-5 w-5" />,
    iconClassName: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  },
  {
    title: "Customizable interactivity",
    description:
      "Configure layers with popups, tooltips, map banners, and expandable side panels to expose rich context about features directly in the map.",
    icon: <ChatBubbleIcon className="h-5 w-5" />,
    iconClassName: "bg-violet-100 text-violet-700 ring-violet-200",
  },

  {
    title: "Basemaps",
    description:
      "Start each project with a curated basemap set, then tailor it by adding custom Mapbox styles or tiled ArcGIS basemap sources for your region and audience.",
    icon: <LayersIcon className="h-5 w-5" />,
    iconClassName: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  },
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
      className={`grid items-center gap-8 md:grid-cols-2 md:gap-16 ${
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
        <div className={featureCopyPanelClass}>
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
    </div>
  );
}

export default function MapPortalHostingPage() {
  return (
    <main className="overflow-x-hidden bg-slate-950 text-slate-100">
      <UseCaseHelmet useCase={mapPortalHostingUseCase} />

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
            <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-6xl">
              Publish a{" "}
              <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                living map
              </span>{" "}
              of your ocean space
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Host, visualize, and share spatial data in a fast, easy-to-use map
              portal. Bring fragmented datasets together into a single common
              picture of your ocean environment, accessible to your community of
              stakeholders.
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
                src={MAP_PORTAL_HERO_IMAGE}
                alt="A SeaSketch map portal showing a map of the ocean with a legend and a search bar"
                width={1920}
                height={1080}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature rows */}
      <section className="relative rounded-t-[2.5rem] bg-gradient-to-b from-white to-slate-100 pt-12 text-slate-900 md:pt-16 lg:pt-24">
        <div className="mx-auto max-w-6xl space-y-16 px-4 pb-12 sm:px-6 md:space-y-20 lg:space-y-28 lg:px-8 lg:pb-12">
          <FeatureRow
            eyebrow="Performance"
            icon={<RocketIcon className="h-5 w-5" />}
            title="Fast, beautiful maps"
            image="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/edaf4e0a-32b6-42e5-308b-c844c0254400/hthumb"
            imageAlt="A SeaSketch reef habitat map with an Outer Reef Flat tooltip appearing instantly under the cursor"
            glowClassName="bg-sky-400/25"
            rowClassName="md:grid-cols-[auto_1fr] md:gap-8 lg:gap-10"
            imageContainerClassName="mx-auto w-full max-w-sm md:w-64 lg:w-72"
          >
            <p>
              One of the first things people notice about SeaSketch is how
              quickly maps load. Spatial data is transformed into static map
              tiles and distributed over a global content delivery network for
              the best possible performance, anywhere in the world.
            </p>
            <p>
              Vector tiles power instant interactivity, so features such as
              popups, tooltips, and hover effects respond immediately as users
              explore.{" "}
              <span className="font-semibold text-slate-900">
                No more loading spinners.
              </span>
            </p>
          </FeatureRow>

          <section className="relative grid items-center gap-8 md:grid-cols-[1fr_minmax(0,1.1fr)] md:gap-20">
            <div className={`${featureCopyPanelClass} order-2 md:order-1`}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <UploadIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Out of the box efficiency
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Build a map portal in minutes
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  SeaSketch projects are free to create and include hosting for
                  up to 10&nbsp;GB of spatial data. Just drag and drop your
                  files into the project and SeaSketch handles optimizing them
                  for the web, with tiling, compression, and styling included.
                </p>
                <p>
                  SeaSketch offers all the essentials of a modern map portal,
                  including legends, metadata, search, folder organization, and
                  more&mdash;all ready to use out of the box.
                </p>
              </div>
              <div className="mt-5">
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
            </div>

            <div className="relative z-10 order-1 overflow-hidden md:order-2 md:overflow-visible md:pl-4 lg:pl-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-y-8 -left-8 -right-8 md:-inset-y-24 md:-left-80 md:-right-28"
              >
                <img
                  src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/0fbce3c0-823e-4d59-9ed2-32bf37377000/hlarge"
                  alt=""
                  className="h-full w-full scale-110 object-cover opacity-85 blur-[1px] md:scale-[1.5]"
                  style={{
                    maskImage:
                      "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
                    WebkitMaskImage:
                      "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
                  }}
                />
              </div>

              <div className="relative mx-auto flex w-full max-w-[440px] flex-col items-center">
                <div className="w-full rounded-2xl border border-white/65 bg-white p-5 shadow-2xl ring-1 ring-slate-200/70">
                  <div className="mx-auto max-w-[360px]">
                    <div className="mb-3 text-center">
                      <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                        Drop files here to upload
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Spatial data will be optimized for the web and added to
                        the layers list.
                      </p>
                    </div>

                    <div className="relative rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 px-4 py-4">
                      <p className="text-center text-sm font-medium text-slate-600">
                        Drop file to upload
                      </p>
                      <div className="pointer-events-none absolute bottom-2 right-14 z-20">
                        <svg
                          aria-hidden
                          viewBox="0 0 18 28"
                          className="h-9 w-6 drop-shadow-[0_1px_1px_rgba(15,23,42,0.25)]"
                        >
                          <path
                            d="M1.4 1.4V23.4l5.9-5.6 3.5 8 3.2-1.4-3.5-7.9h6.1L1.4 1.4Z"
                            fill="#000000"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex w-max scale-[0.85] flex-col items-center md:bottom-[-48px] md:right-[-42px] md:scale-100">
                        <svg
                          aria-hidden
                          viewBox="0 0 44 50"
                          className="h-11 w-10"
                        >
                          <path
                            d="M6.5 3h18l11 11v31.5A1.5 1.5 0 0 1 34 47H8a1.5 1.5 0 0 1-1.5-1.5V4.5A1.5 1.5 0 0 1 8 3Z"
                            fill="#ffffff"
                            stroke="#94a3b8"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M24.5 3v9.5a1 1 0 0 0 1 1H35"
                            fill="#e2e8f0"
                            stroke="#94a3b8"
                            strokeWidth="1.4"
                          />
                          <rect
                            x="9.5"
                            y="29"
                            width="23"
                            height="11"
                            rx="2.2"
                            fill="#0284c7"
                          />
                          <text
                            x="21"
                            y="36.5"
                            textAnchor="middle"
                            fontSize="7"
                            fontWeight="700"
                            fill="#ffffff"
                            style={{ fontFamily: "ui-sans-serif, system-ui" }}
                          >
                            ZIP
                          </text>
                        </svg>
                        <div className="mt-1 rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-medium leading-tight text-white shadow-md">
                          PISCO-monitoring-sites.zip
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none mt-8 w-full max-w-[320px] rounded-xl border border-slate-200/70 bg-white/95 p-3 shadow-xl ring-1 ring-slate-200/70 backdrop-blur-sm">
                  {/* <div
                    className="uppercase text-slate-500 mb-0.5"
                    style={{ fontSize: 7 }}
                  >
                    processing
                  </div> */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UploadIcon className="h-4 w-4 shrink-0 text-slate-600" />
                      <span className="truncate text-sm font-medium text-slate-900">
                        study-areas.json
                      </span>
                    </div>
                    <span className="shrink-0 text-sm italic text-slate-700">
                      AI cartographer...
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-[62%] rounded-full bg-indigo-500" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid items-center gap-8 md:grid-cols-2 md:gap-24 lg:gap-28">
            <div className="relative md:pr-6">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-cyan-400/25 blur-3xl"
              />
              <div className="relative mx-auto max-w-[620px]">
                <div className="relative z-10 overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-2xl ring-1 ring-slate-200/70">
                  <img
                    src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/27efd335-1e93-45d1-397b-74fb1dd25d00/hlarge"
                    alt="Graphical cartography panel with color palette, opacity, and AI style suggestions"
                    loading="lazy"
                    className="w-full"
                  />
                </div>
                <div className="max-md:relative max-md:top-auto max-md:right-auto max-md:mt-4 max-md:w-full max-md:max-w-none absolute -right-8 top-[34%] z-20 w-[56%] max-w-[420px] overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-xl ring-1 ring-slate-200/70 backdrop-blur-sm md:-right-10 md:top-[25%] md:w-[65%] lg:-right-12 lg:top-[25%]">
                  <img
                    src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/a7ee5dd9-6ebc-49ba-e143-9134515d5200/hthumb"
                    alt="AI Cartographer Notes explaining category styles and color palette recommendations"
                    loading="lazy"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            <div className={`${featureCopyPanelClass} md:ml-4 lg:ml-6`}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <MagicWandIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Cartography
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Style layers with AI and graphical tools
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  When you upload a layer, SeaSketch can use AI to suggest a
                  title, attribution, and an appropriate cartographic style, so
                  your data looks great from the moment it appears. Add dozens
                  or hundreds of layers in an afternoon.
                </p>
                <p>
                  Then, fine-tune everything with our advanced graphical
                  cartography tools. Adjust color palettes, opacity, labels, and
                  interactivity options without writing a single line of code.
                  Changes appear instantly.
                </p>
              </div>
            </div>
          </section>

          <section className="grid items-center gap-8 md:grid-cols-2 md:gap-20 lg:gap-24">
            <div className={featureCopyPanelClass}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <LockClosedIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  More than just pretty maps
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Powerful data governance
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Role-based access control lets you share layers with specific
                  user groups and decide whether to enable source data download.
                  Administrators collaborate on a draft layer list together,
                  then publish final changes to the public after review.
                </p>
                <p>
                  Dedicated views help you manage hundreds of layers,
                  summarizing access control, quota usage, and other critical
                  settings.
                </p>
                <p>
                  A complete changelog tracks every update made by project
                  administrators. In a large, collaboratively managed project,
                  you always know who changed what, and when. You can even roll
                  back certain changes like cartographic styles or source data
                  updates.
                </p>
              </div>
            </div>

            <div className="relative md:pl-4">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-indigo-400/25 blur-3xl"
              />
              <div className="relative mx-auto max-w-[620px]">
                <div className="relative z-10 overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-2xl ring-1 ring-slate-200/70">
                  <img
                    src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/357b749a-42ff-498c-8001-f6be85c16000/hlarge"
                    alt="Layer list with a role-based access control panel overlaid on a map"
                    loading="lazy"
                    className="w-full"
                  />
                </div>
                <div className="max-md:relative max-md:left-auto max-md:bottom-auto max-md:mt-4 max-md:w-full max-md:max-w-none absolute -left-8 bottom-[-2.5rem] z-20 w-[52%] max-w-[360px] overflow-hidden rounded-xl border border-white/70 bg-white/95 shadow-xl ring-1 ring-slate-200/70 backdrop-blur-sm md:-left-10 md:bottom-[-2.75rem] lg:-left-12 lg:bottom-[-3rem]">
                  <img
                    src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/4709d788-0c4b-4473-df64-8d298af02700/hthumb"
                    alt="Layer history changelog with actions like updates, publishing, and folder moves"
                    loading="lazy"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* Vision statement + additional features */}
      <section className="bg-slate-100 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28 mb-4">
          <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm ring-1 ring-white/50 backdrop-blur-sm md:p-10">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              A comprehensive solution
            </div>
            <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              SeaSketch makes it easy to visualize, share, and manage ocean
              data.
            </h2>
            <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">
              With a 14-year track record and a steadily expanding feature set,
              SeaSketch supports near-term planning decisions, adaptive
              management, and long-term ocean data stewardship.
            </p>
            <p className="mt-4">
              <a
                href="https://docs.seasketch.org/seasketch-documentation/administrators-guide/overlay-layers"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
              >
                <FileTextIcon className="h-4 w-4" />
                Read the Documentation
              </a>
            </p>
          </div>

          <div className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                  Additional Features
                </h3>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {additionalFeatureCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${card.iconClassName}`}
                  >
                    {card.icon}
                  </span>
                  <h4 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
                    {card.title}
                  </h4>
                  <p className="mt-3 leading-7 text-slate-600">
                    {card.description}
                  </p>
                </article>
              ))}
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
            Spin up a free project and build a fast, beautiful map portal today.
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
