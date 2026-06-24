/* eslint-disable i18next/no-literal-string */
import {
  ChevronRightIcon,
  CollectionIcon,
  InformationCircleIcon,
  LockClosedIcon,
  TranslateIcon,
} from "@heroicons/react/outline";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ArrowLeftIcon,
  BarChartIcon,
  ChatBubbleIcon,
  CodeIcon,
  DownloadIcon,
  FileTextIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import Testimonial from "../caseStudies/components/Testimonial";
import ReportCardMontage from "./ReportCardMontage";
import { sketchingAndAnalysisUseCase } from "./useCaseDefs";
import UseCaseHelmet from "./UseCaseHelmet";
import { CLOUDFLARE_IMAGES } from "./cloudflareImages";

const featureCopyPanelClass =
  "relative z-20 rounded-2xl border border-white/60 bg-white/65 p-5 shadow-sm backdrop-blur-sm md:p-6";

const SKETCH_BACKDROP = `${CLOUDFLARE_IMAGES}/49341eb7-5ac5-4f7a-44a9-32ce5e2cab00/hlarge`;
const REPORT_HERO = `${CLOUDFLARE_IMAGES}/c9452e46-bf89-4d66-ca1f-f21b5ad8d400/hlarge`;
const SKETCHING_HERO_IMAGE = `${CLOUDFLARE_IMAGES}/45106a3c-a728-4e0e-6dc1-71b2228f2400/hlarge`;
const SKETCHING_MAP_BACKDROP = `${CLOUDFLARE_IMAGES}/fe4802cc-75db-48aa-ed36-175e0a712c00/hlarge`;
const FORUM_BOOKMARK_THUMBNAIL = `${CLOUDFLARE_IMAGES}/74561fa4-2a04-4dfd-98a0-72e2d65e5300/public`;
const GEOGRAPHY_SELECTION_IMAGE = `${CLOUDFLARE_IMAGES}/379f8ca3-64aa-4a5b-3019-493ca9bbd900/hlarge`;
const SKETCHING_STEP_IMAGE = `${CLOUDFLARE_IMAGES}/8f8c5920-ff3d-4aea-2e62-6d59fba4e900/hlarge`;
const REPORT_AUTHORING_IMAGE = `${CLOUDFLARE_IMAGES}/5584eeab-e603-4922-8087-1db721eca000/hlarge`;
const CHAD_GRAVATAR =
  "https://www.gravatar.com/avatar/b0a4285bfc440a2efad5036bb95d68a9?s=48&d=mp&r=pg";

const FEATHERED_MASK_STYLE = {
  maskImage:
    "radial-gradient(76% 62% at 70% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
  WebkitMaskImage:
    "radial-gradient(76% 62% at 70% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
};

const MAP_VIEWBOX = { width: 1024, height: 608 };

type SketchVertex = { x: number; y: number; active?: boolean };

/** Sketch polygon vertices in map viewBox coordinates */
const SKETCH_VERTICES: SketchVertex[] = [
  { x: 392, y: 176 },
  { x: 628, y: 176 },
  { x: 652, y: 512, active: true },
  { x: 372, y: 492 },
];

function SketchCursor({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 18 28" className={className}>
      <path
        d="M1.4 1.4V23.4l5.9-5.6 3.5 8 3.2-1.4-3.5-7.9h6.1L1.4 1.4Z"
        fill="#000000"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VertexHandle({
  cx,
  cy,
  active,
}: {
  cx: number;
  cy: number;
  active?: boolean;
}) {
  const radius = active ? 9 : 7;
  return (
    <g>
      <circle cx={cx} cy={cy} r={radius + 2.5} fill="#ffffff" opacity="0.95" />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="#f97316"
        stroke="#ffffff"
        strokeWidth={active ? 2.5 : 1.5}
      />
    </g>
  );
}

function MidpointHandle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill="#fb923c"
      stroke="#ffffff"
      strokeWidth="1.2"
    />
  );
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function DigitizingWorkflowDemo() {
  const polygonPoints = SKETCH_VERTICES.map((v) => `${v.x},${v.y}`).join(" ");
  const midpoints = SKETCH_VERTICES.map((vertex, index) => {
    const next = SKETCH_VERTICES[(index + 1) % SKETCH_VERTICES.length];
    return midpoint(vertex, next);
  });
  const activeVertex =
    SKETCH_VERTICES.find((v) => v.active) ?? SKETCH_VERTICES[2];

  return (
    <div className="relative mx-auto w-full max-w-[620px] py-2 md:py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-y-10 -inset-x-5 md:-inset-y-16 md:-inset-x-5"
      >
        <img
          src={SKETCHING_MAP_BACKDROP}
          alt=""
          width={MAP_VIEWBOX.width}
          height={MAP_VIEWBOX.height}
          className="h-full w-full scale-110 object-cover opacity-80 blur-[1px] md:scale-[1.35]"
          style={FEATHERED_MASK_STYLE}
        />
      </div>

      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] bg-sky-400/25 blur-3xl"
      />

      <div
        className="relative overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl ring-1 ring-slate-200/70"
        role="img"
        aria-label="SeaSketch digitizing interface showing a polygon being edited on a coastal map with vertex handles and editing controls"
      >
        <div
          className="relative w-full"
          style={{
            aspectRatio: `${MAP_VIEWBOX.width} / ${MAP_VIEWBOX.height}`,
          }}
        >
          <img
            src={SKETCHING_MAP_BACKDROP}
            alt=""
            width={MAP_VIEWBOX.width}
            height={MAP_VIEWBOX.height}
            className="absolute inset-0 h-full w-full object-cover"
          />

          <svg
            aria-hidden
            viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid slice"
          >
            <polygon
              points={polygonPoints}
              fill="rgba(125, 211, 252, 0.38)"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeDasharray="9 6"
              strokeLinejoin="round"
            />
            {midpoints.map((point, index) => (
              <MidpointHandle key={`mid-${index}`} cx={point.x} cy={point.y} />
            ))}
            {SKETCH_VERTICES.map((vertex, index) => (
              <VertexHandle
                key={`vertex-${index}`}
                cx={vertex.x}
                cy={vertex.y}
                active={vertex.active}
              />
            ))}
          </svg>

          <div
            className="pointer-events-none absolute z-20"
            style={{
              left: `${(activeVertex.x / MAP_VIEWBOX.width) * 100}%`,
              top: `${(activeVertex.y / MAP_VIEWBOX.height) * 100}%`,
              transform: "translate(6px, 4px)",
            }}
          >
            <SketchCursor className="h-9 w-6 drop-shadow-[0_1px_2px_rgba(15,23,42,0.35)]" />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3 sm:bottom-4">
            {/* <div className="flex w-full max-w-[min(100%,420px)] items-center gap-2 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-2 shadow-xl ring-1 ring-slate-200/80 backdrop-blur-sm sm:gap-3 sm:px-3 sm:py-2.5">
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700 sm:text-xs">
                Drag points to modify
              </span>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="shrink-0 rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm sm:px-4 sm:text-xs"
              >
                Done Editing
              </button>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}

const ADRIANO_HEADSHOT = `${CLOUDFLARE_IMAGES}/d519a37f-22b7-40f2-e998-6f9539be8000/thumbnail`;

const ADRIANO_QUOTE =
  "SeaSketch helped empower our region to design the largest offshore MPA network in the North Atlantic—not just with scientific rigor, but with community voices guiding every boundary.";

function ForumThreadDemo() {
  const replyDate = new Date();
  replyDate.setDate(replyDate.getDate() - 7);
  const formattedDate = replyDate.toLocaleTimeString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white pt-3 shadow-xl shadow-slate-300/40">
      <div className="mb-3 px-4 text-gray-600">
        <div className="flex items-center">
          <div className="flex h-6 w-6 flex-none items-center rounded-full">
            <img
              src={CHAD_GRAVATAR}
              alt="Chad Burt"
              className="h-6 w-6 rounded-full"
            />
          </div>
          <div className="ml-2 flex items-center space-x-1 text-sm">
            <span className="inline-block max-w-[13rem] truncate rounded font-semibold">
              Chad Burt
            </span>
            <span className="inline-flex">replied on</span>
            <span className="inline-flex">{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="ProseMirrorBody ForumPost space-y-4 px-4 pb-4">
        <p>
          This option was presented to the Minister for consideration as the
          final offshore MPA Network. A total of 29.95% of the EEZ, with 9
          no-take zones. The remaining 0.05% of the 30% national protection goal
          will be achieved with coastal &amp; inshore protected areas.
        </p>

        <div className="ml-2 text-sm">
          <div
            role="treeitem"
            className="relative max-w-full rounded border border-transparent"
          >
            <div className="label-container group flex items-center space-x-0.5 text-sm">
              <span className="pr-0.5">
                <ChevronRightIcon className="h-4 w-4 rotate-0 transform text-gray-700 transition duration-100" />
              </span>
              <div
                role="checkbox"
                aria-checked="true"
                aria-label="Toggle visibility"
                className="relative flex h-4 w-4 flex-none cursor-default items-center justify-center overflow-hidden rounded bg-primary-900"
              >
                <svg className="absolute h-4 w-4" aria-hidden>
                  <path
                    d="M4.5 8l2 2.5L11.5 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    stroke="white"
                    fill="transparent"
                    strokeWidth="2px"
                  />
                </svg>
              </div>
              <CollectionIcon
                stroke="currentColor"
                fill="currentColor"
                fillOpacity={0.2}
                strokeWidth={1}
                style={{ height: 22 }}
                className="-mt-1 w-6 text-primary-700"
              />
              <span className="min-w-0 cursor-default select-none truncate px-1">
                Final Draft 1.4 Network
              </span>
            </div>
          </div>
        </div>

        <p>
          Attached is the sketch of final draft 1.4. Feel free to download and
          run reports.
        </p>
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-2 pt-1">
        <div className="group relative float-left ml-3.5 mt-2.5 box-content h-14 w-24 overflow-hidden rounded border bg-white shadow-sm">
          <img
            src={FORUM_BOOKMARK_THUMBNAIL}
            alt="Bookmark preview thumbnail"
            className="absolute left-0 top-0 h-full w-full object-cover"
          />
          <span className="absolute bottom-1 right-1">
            <Tooltip.Provider delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    className="rounded-full bg-white bg-opacity-20 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    aria-label="About map bookmarks"
                  >
                    <InformationCircleIcon className="h-4 w-4 text-white" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-50 max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
                    side="top"
                    sideOffset={6}
                  >
                    Map bookmarks save the current view—basemap, visible layers,
                    zoom, and sketches—so others can restore the same map
                    context with one click.
                    <Tooltip.Arrow className="fill-gray-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </span>
        </div>
        <div className="clear-both" />
      </div>
    </div>
  );
}

type WorkflowStepProps = {
  step: string;
  title: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  children: ReactNode;
};

/** Matches geography selection screenshot (2512×2064) — template for card image height */
function WorkflowStep({
  step,
  title,
  image,
  imageAlt,
  imagePosition = "object-top",
  children,
}: WorkflowStepProps) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden border-b border-slate-200/80 bg-slate-100 aspect-[2512/2064]">
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover ${imagePosition}`}
        />
      </div>
      <div className="p-6 md:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          {step}
        </div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
        <div className="mt-4 space-y-3 text-base leading-7 text-slate-600">
          {children}
        </div>
      </div>
    </article>
  );
}

type AdditionalFeatureCard = {
  title: string;
  description: ReactNode;
  icon: ReactNode;
  iconClassName: string;
};

const additionalFeatureCards: AdditionalFeatureCard[] = [
  {
    title: "Collections & networks",
    description:
      "Group individual zones into networks that can be analyzed together, supporting comprehensive planning and MPA network design.",
    icon: <CollectionIcon className="h-5 w-5" />,
    iconClassName: "bg-sky-100 text-sky-700 ring-sky-200",
  },
  {
    title: "Forum moderation",
    description:
      "The discussion forums include tools to moderate and manage forum content, including the ability to hide or delete posts and topics.",
    icon: <ChatBubbleIcon className="h-5 w-5" />,
    iconClassName: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  {
    title: "Export to GIS, CSV, and JSON",
    description:
      "Download sketches as GeoJSON for desktop GIS workflows, or export report tables to CSV and JSON for further analysis.",
    icon: <DownloadIcon className="h-5 w-5" />,
    iconClassName: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  },
  {
    title: "Localized content",
    description:
      "The SeaSketch UI is available in dozens of languages, with support for translated sketch attribute forms and reports.",
    icon: <TranslateIcon className="h-5 w-5" />,
    iconClassName: "bg-violet-100 text-violet-700 ring-violet-200",
  },
  {
    title: "Personal workspace",
    description:
      "Every participant gets a private sketching workspace to draft ideas before sharing proposals in forums or collaborative sessions.",
    icon: <LockClosedIcon className="h-5 w-5" />,
    iconClassName: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  },
  {
    title: "Open geoprocessing framework",
    description: (
      <>
        In addition to the graphical report builder, reports can be authored
        using our{" "}
        <a
          href="https://github.com/seasketch/geoprocessing"
          target="_blank"
          rel="noreferrer"
          className="text-sky-700 hover:text-sky-900 hover:underline"
        >
          TypeScript-based geoprocessing framework
        </a>
        .
      </>
    ),
    icon: <CodeIcon className="h-5 w-5" />,
    iconClassName: "bg-amber-100 text-amber-700 ring-amber-200",
  },
];

export default function SketchingAndAnalysisPage() {
  return (
    <main className="overflow-x-hidden bg-slate-950 text-slate-100">
      <UseCaseHelmet useCase={sketchingAndAnalysisUseCase} />

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
              Sketching and Analysis
            </span>
            <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-6xl">
              Draw zones, run reports,{" "}
              <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                iterate
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              SeaSketch enables collaborative and inclusive marine spatial
              planning with easy-to-use scenario design and analysis tools.
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
                src={SKETCHING_HERO_IMAGE}
                alt="Blue Azores SeaSketch project showing an offshore MPA proposal on the map with a habitat coverage report open in the sidebar"
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
          <section className="grid items-center gap-8 md:grid-cols-2 md:gap-20 lg:gap-24">
            <div className="relative">
              <DigitizingWorkflowDemo />
            </div>
            <div className={featureCopyPanelClass}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <Pencil2Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Digitizing
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Design tools for everyone
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Our sketching tools were built for truly participatory
                  planning—not just GIS for specialists. Users can draw
                  polygons, lines, or points directly on the map, then refine
                  vertices with intuitive editing controls.
                </p>
                <p>
                  SeaSketch can automatically clip sketches to shorelines, EEZ
                  boundaries, or other project geographies as soon as editing
                  finishes, so proposals meet project requirements and are ready
                  for analysis. Attribute forms can be tied to sketches to
                  capture details such as allowed uses, designation type, or
                  facility capacity.
                </p>
                <p>
                  Each user maintains a personal workspace to draft ideas before
                  sharing them with the group. Finished sketches and networks
                  can be exported for use in desktop GIS workflows if needed.
                </p>
              </div>
            </div>
          </section>

          <section className="relative grid items-center gap-8 md:grid-cols-[1fr_minmax(0,1.05fr)] md:gap-20 lg:gap-24">
            <div className={`${featureCopyPanelClass} order-2 md:order-1`}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <BarChartIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Reports
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Immediate analytical feedback
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Analytical reports provide instant feedback on each sketch,
                  summarizing overlap with habitats, human uses, ecosystem
                  services, and other key metrics defined by project
                  administrators. You can set targets and thresholds to assess
                  proposals against planning objectives. Every stakeholder
                  accesses the same set of tools to evaluate proposals,
                  promoting transparency and fairness throughout the process.
                </p>
                <p>
                  Participatory planning is stressful enough without waiting in
                  a workshop for slow, buggy, or manual analysis. Our{" "}
                  <i className="italic">overlay-engine</i> starts in the
                  background and runs report calculations across hundreds of
                  workers in parallel, so results are available almost
                  immediately after sketching. Reports update as sketches are
                  refined, supporting rapid iteration during workshops and
                  online collaboration.
                </p>
              </div>
            </div>

            <div className="relative order-1 md:order-2 md:pl-4 lg:pl-6">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-emerald-400/25 blur-3xl"
              />
              <div className="relative mx-auto max-w-[620px]">
                <div className="relative z-10 overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-2xl ring-1 ring-slate-200/70">
                  <img
                    src={REPORT_HERO}
                    alt="SeaSketch analytical report showing habitat coverage and planning metrics for a sketched zone"
                    loading="lazy"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid items-center gap-8 md:grid-cols-2 md:gap-20 lg:gap-24">
            <div className="relative z-10 order-2 overflow-hidden md:order-1 md:overflow-visible md:pr-4">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-y-8 -left-8 -right-8 md:-inset-y-24 md:-left-80 md:-right-28"
              >
                <img
                  src={SKETCH_BACKDROP}
                  alt=""
                  className="h-full w-full scale-110 object-cover opacity-85 blur-[1px] md:scale-[1.1]"
                  style={{
                    maskImage:
                      "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
                    WebkitMaskImage:
                      "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
                  }}
                />
              </div>

              <div className="relative mx-auto flex min-h-[280px] w-full max-w-[480px] items-center justify-center py-8 md:min-h-[360px]">
                <ForumThreadDemo />
              </div>
            </div>

            <div
              className={`${featureCopyPanelClass} order-1 md:order-2 md:ml-4 lg:ml-6`}
            >
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <ChatBubbleIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Discussion Forums
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Collaborative planning
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Discussion forums connect sketching and analysis to the
                  conversations that shape decisions. Participants share
                  proposals, attach sketches, and bookmark exact map views so
                  others can see the same context—basemap, layers, zoom, and
                  sketches included.
                </p>
                <p>
                  Reviewers can toggle shared sketches on the map, generate
                  reports on attached proposals, and reply with refined
                  alternatives. Access controls let administrators run public
                  consultations alongside closed working groups.
                </p>
                <p>
                  Forum threads become a living record of how plans evolve.
                  There are SeaSketch threads detailing conversations that led
                  to MPA network designs{" "}
                  <a
                    href="https://legacy.seasketch.org/#projecthomepage/50d4dda98aba40751816a698/forum/51e726f3ed455b433716ff6b/topic/524c2b56b73854a810000a26"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 hover:text-sky-800 hover:underline"
                  >
                    from over a decade ago
                  </a>
                  , complete with draft sketches.
                </p>
              </div>
            </div>
          </section>

          <div className="-my-6 md:-my-8">
            <div className="mx-auto max-w-4xl px-2">
              <Testimonial
                compact
                quote={ADRIANO_QUOTE}
                author="Adriano Quintela"
                affiliation="Blue Azores Initiative"
                headshotSrc={ADRIANO_HEADSHOT}
                link={{ label: "Azores Project", to: "/case-studies/azores" }}
              />
            </div>
          </div>

          {/* How does it work? */}
          <div>
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                How does it work?
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                From project setup to instant reports
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Administrators configure the building blocks—geographies, sketch
                classes, and reports—then participants sketch and analyze
                scenarios in a structured, customizable workflow.
              </p>
              <p className="mt-4">
                <a
                  href="https://docs.seasketch.org/seasketch-documentation/administrators-guide/sketch-classes"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
                >
                  <FileTextIcon className="h-4 w-4" />
                  Read the Documentation
                </a>
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8">
              <WorkflowStep
                step="Step 1"
                title="Geographies"
                image={GEOGRAPHY_SELECTION_IMAGE}
                imageAlt="SeaSketch geography selection interface showing planning area polygons on a map"
                imagePosition="object-center"
              >
                <p>
                  When creating a project, choose a planning geography such as
                  an Exclusive Economic Zone.
                </p>
                <p>
                  Additional geographies can be added later to represent areas
                  such as territorial seas, bioregions, or administrative
                  boundaries. These can be used to summarize statistics in
                  reports.
                </p>
              </WorkflowStep>

              <WorkflowStep
                step="Step 2"
                title="Sketch Classes"
                image={SKETCHING_STEP_IMAGE}
                imageAlt="SeaSketch sketching interface showing a participant drawing an area of interest on a map with an attribute form"
              >
                <p>
                  Sketch classes define the zone types participants can draw—
                  Marine Protected Areas, renewable energy sites, aquaculture
                  areas, and more. Each class specifies the geometry type and
                  attribute forms.
                </p>
                <p>
                  SeaSketch can clip sketches to your project's geographies,
                  including removing land from marine zones.
                </p>
              </WorkflowStep>

              <WorkflowStep
                step="Step 3"
                title="Reports"
                image={REPORT_AUTHORING_IMAGE}
                imageAlt="SeaSketch report builder with metric widgets and tabbed report sections"
              >
                <p>
                  Author custom reports using a rich-text editor. Embed
                  visualizations of metrics calculated from spatial data
                  uploaded to your project. Set goals and objectives, report
                  progress toward targets, and calculate levels of protection.
                </p>
                <p>
                  Reports use the latest versions of referenced data and match
                  cartographic styles.
                </p>
              </WorkflowStep>
            </div>
          </div>

          <ReportCardMontage />
        </div>
      </section>

      {/* Additional features + links */}
      <section className="bg-slate-100 text-slate-900">
        <div className="mx-auto mb-4 max-w-6xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <div className="">
            <h3 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Additional Features
            </h3>

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
            Ready to start planning?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Create a free project, configure sketch classes, and start
            iterating.
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
