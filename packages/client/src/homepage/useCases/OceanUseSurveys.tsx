/* eslint-disable i18next/no-literal-string */
import { ReactNode } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  BookOpenIcon,
  DocumentTextIcon,
  ExternalLinkIcon,
  MapIcon,
  StatusOfflineIcon,
  UserGroupIcon,
} from "@heroicons/react/outline";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  LockClosedIcon,
  MobileIcon,
  Pencil2Icon,
  PlayIcon,
} from "@radix-ui/react-icons";
import Testimonial from "../caseStudies/components/Testimonial";
import AppleDeviceFrame from "./AppleDeviceFrame";
import { ipadPro11LandscapeSpaceBlack, macbookPro14 } from "./deviceFrames";

export const oceanUseSurveysUseCase = {
  id: "ocean-use-surveys",
  to: "/uses/ocean-use-surveys",
  title: "Ocean Use Surveys",
  navLabel: "Ocean Use Surveys",
  readMoreLabel: "Read more about Ocean Use Surveys",
  summary:
    "Collect local knowledge directly on the map—structured, spatial, analysis-ready. Run multi-language campaigns with ease.",
  bullets: [
    "Build spatial surveys for desktop and mobile",
    "Support multi-language campaigns",
    "Prepare survey data for analysis",
  ],
};

const featureCopyPanelClass =
  "relative z-20 rounded-2xl border border-white/60 bg-white/65 p-5 shadow-sm backdrop-blur-sm md:p-6";

const CLOUDFLARE_IMAGES =
  "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw";

const PHONE_DIGITIZING_IMAGE = `${CLOUDFLARE_IMAGES}/902e86c5-8372-4e7c-dd14-f5978c92bd00/hlarge`;

const MALDIVES_INTRO_IMAGE = `${CLOUDFLARE_IMAGES}/96b66429-2833-4927-e7fb-4d19a0e87700/hlarge`;

const AZORES_INTRO_LANDSCAPE_IMAGE = `${CLOUDFLARE_IMAGES}/e44087da-fe74-4ae5-f738-71cc8bb7bd00/hlarge`;

const SURVEY_EDITOR_IMAGE = `${CLOUDFLARE_IMAGES}/f62cbeab-146a-463a-2b50-843acffec500/hlarge`;

const SECTORS_AZORES_IMAGE = `${CLOUDFLARE_IMAGES}/4d11cbc2-1304-4dd8-595a-36dbd45aa800/hlarge`;

const OUS_HEATMAP_FOOTER = `${CLOUDFLARE_IMAGES}/73c27e57-dc90-45bb-3d31-3dc231323900/hlarge`;

const MALDIVES_REEF_BACKDROP = MALDIVES_INTRO_IMAGE;

const actionableInsightLinks: {
  label: string;
  href: string;
  external?: boolean;
  icon: ReactNode;
}[] = [
  {
    label: "Documentation",
    href: "https://docs.seasketch.org/seasketch-documentation/administrators-guide/surveys",
    external: true,
    icon: <FileTextIcon className="h-4 w-4 shrink-0" />,
  },
  {
    label: "Case Studies",
    href: "/case-studies",
    icon: <BookOpenIcon className="h-4 w-4 shrink-0" />,
  },
  {
    label: "OUS Shiny Dashboard",
    href: "https://github.com/mcclintock-lab/ous-shiny-demo",
    external: true,
    icon: <ExternalLinkIcon className="h-4 w-4 shrink-0" />,
  },
  {
    label: "Heatmap Generator",
    href: "https://github.com/mcclintock-lab/heatmap-web-interface",
    external: true,
    icon: <ExternalLinkIcon className="h-4 w-4 shrink-0" />,
  },
];

const HULWA_HEADSHOT = `${CLOUDFLARE_IMAGES}/f37c657b-96d2-4861-6365-45a6367e8300/thumbnail`;

const HULWA_QUOTE =
  "The Ocean Use Survey gave voice to thousands of Maldivians whose lives and livelihoods depend on the sea. With SeaSketch, we were able to capture this indigenous knowledge at a national scale for the first time, and turn it into a living resource of maps and interactive data that we, and others, can continue to analyze to inform decision-making and ensure community perspectives shape ocean planning.";

const AZORES_LANDSCAPE_CONTACT_MASK = {
  className: "bottom-[12%] left-0 h-[5%] w-[48%] bg-[#4d6670]",
};

const MALDIVES_CONTACT_MASK = {
  className: "bottom-[14%] left-0 h-[6%] w-[52%] bg-[#1a5252]",
};

const SURVEY_LANGUAGES: {
  code: string;
  label: string;
  englishName?: string;
  selected: boolean;
}[] = [
  { code: "EN", label: "English", selected: true },
  { code: "DV", label: "ދިވެހި", englishName: "Dhivehi", selected: false },
];

const FEATHERED_MASK_STYLE = {
  maskImage:
    "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
  WebkitMaskImage:
    "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
};

function SurveyLanguagePickerDemo() {
  return (
    <div
      className="w-full max-w-xs rounded-lg border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-slate-200/80"
      role="listbox"
      aria-label="Select a language"
    >
      <div className="text-sm font-medium text-slate-800">
        Select a language
      </div>
      <ul className="mt-3 space-y-1">
        {SURVEY_LANGUAGES.map((language) => (
          <li key={language.code}>
            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition ${
                language.selected
                  ? "bg-sky-100 font-medium text-sky-900 ring-1 ring-sky-200"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              aria-selected={language.selected}
            >
              <span className="flex min-w-0 items-baseline gap-4">
                <span>{language.label}</span>
                {language.englishName ? (
                  <span
                    className={`font-normal ${
                      language.selected ? "text-sky-700/55" : "text-slate-400"
                    }`}
                  >
                    {language.englishName}
                  </span>
                ) : null}
              </span>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                {language.code}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReefFeatheredBackdrop() {
  return (
    <img
      src={MALDIVES_REEF_BACKDROP}
      alt=""
      aria-hidden
      className="h-full w-full scale-125 object-cover opacity-90 blur-[1px]"
      style={{
        objectPosition: "92% 42%",
        ...FEATHERED_MASK_STYLE,
      }}
    />
  );
}

function SurveyDeviceMontage({ layout }: { layout: "hero" | "feature" }) {
  const isHero = layout === "hero";

  return (
    <div
      className={
        isHero
          ? "relative mt-14 pb-6 md:pb-10"
          : "relative overflow-visible pb-4 md:pb-8"
      }
    >
      <div
        aria-hidden
        className={`absolute -inset-8 -z-10 rounded-[3rem] blur-3xl ${
          isHero
            ? "bg-gradient-to-tr from-sky-500/20 via-cyan-400/10 to-emerald-400/20"
            : "bg-gradient-to-tr from-sky-400/20 via-cyan-300/10 to-emerald-300/15"
        }`}
      />

      <div
        className={`relative overflow-visible px-2 sm:px-0 ${
          isHero
            ? "mx-auto w-full max-w-5xl"
            : "mx-auto w-full max-w-2xl lg:max-w-3xl"
        }`}
      >
        <div
          className={`relative overflow-visible ${
            isHero
              ? "min-h-[300px] sm:min-h-[340px] md:min-h-[380px] lg:min-h-[420px]"
              : "pt-2 pb-8 md:pb-10"
          }`}
        >
          <div
            className={`relative z-10 drop-shadow-2xl ${
              isHero
                ? "mx-auto w-full max-w-[min(100%,680px)] md:ml-[10%] md:max-w-3xl lg:ml-[12%]"
                : "mx-auto w-full max-w-lg md:ml-[8%] md:max-w-xl lg:max-w-2xl"
            }`}
          >
            <AppleDeviceFrame
              spec={macbookPro14}
              screenSrc={MALDIVES_INTRO_IMAGE}
              screenAlt="Maldives Ocean Use Survey welcome screen on a MacBook Pro"
              hideContactFooter={MALDIVES_CONTACT_MASK}
            />
          </div>

          <div
            className={`absolute z-20 hidden origin-bottom-left -rotate-[8deg] md:block ${
              isHero
                ? "bottom-[4%] left-0 w-[54%] max-w-[320px] lg:max-w-[380px] xl:max-w-[400px]"
                : "bottom-[6%] left-0 w-[50%] max-w-[260px] lg:max-w-[300px]"
            }`}
          >
            <AppleDeviceFrame
              spec={ipadPro11LandscapeSpaceBlack}
              screenSrc={AZORES_INTRO_LANDSCAPE_IMAGE}
              screenAlt="Blue Azores Ocean Use Survey welcome screen on an iPad Pro in landscape"
              className="drop-shadow-2xl"
              hideContactFooter={AZORES_LANDSCAPE_CONTACT_MASK}
            />
          </div>

          <div
            className={`absolute z-30 origin-bottom-right rotate-[5deg] ${
              isHero
                ? "bottom-0 right-0 w-[32%] max-w-[190px] sm:max-w-[210px] md:right-[1%] md:max-w-[235px] lg:max-w-[255px]"
                : "bottom-1 right-0 w-[28%] max-w-[150px] sm:max-w-[165px] md:right-[2%] md:max-w-[185px] lg:max-w-[200px]"
            }`}
          >
            <img
              src={PHONE_DIGITIZING_IMAGE}
              alt="Ocean Use Survey map digitizing interface on a phone"
              className="block w-full drop-shadow-2xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SurveyGraphNode({
  x,
  y,
  width,
  label,
  iconColor,
  icon,
}: {
  x: number;
  y: number;
  width: number;
  label: string;
  iconColor: string;
  icon: ReactNode;
}) {
  const height = 36;
  const iconSize = 36;
  return (
    <g filter="url(#graphNodeShadow)">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="4"
        fill="#ffffff"
        stroke="#d1d5db"
        strokeWidth="1"
      />
      <rect
        x={x}
        y={y}
        width={iconSize}
        height={height}
        rx="4"
        fill={iconColor}
      />
      <rect
        x={x + iconSize - 4}
        y={y}
        width="4"
        height={height}
        fill={iconColor}
      />
      <g transform={`translate(${x + 10}, ${y + 10})`}>{icon}</g>
      <text
        x={x + iconSize + 10}
        y={y + 22}
        fontSize="11.5"
        fill="#1f2937"
        style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      >
        {label}
      </text>
    </g>
  );
}

function GraphEdgeLabel({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  const width = label.length * 6.2 + 14;
  return (
    <g>
      <rect
        x={x - width / 2}
        y={y - 9}
        width={width}
        height="18"
        rx="3"
        fill="#ffffff"
        stroke="#e5e7eb"
        strokeWidth="1"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize="10"
        fill="#6b7280"
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        {label}
      </text>
    </g>
  );
}

function SkipLogicFlowBackground() {
  const cx = 420;
  const nodeW = 248;
  const nodeX = cx - nodeW / 2;

  return (
    <svg
      aria-hidden
      viewBox="0 0 840 560"
      className="h-full w-full scale-110 object-cover opacity-95 blur-[0.5px] md:scale-[1.35]"
      style={{
        maskImage:
          "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
        WebkitMaskImage:
          "radial-gradient(76% 62% at 74% 53%, rgba(0,0,0,1) 12%, rgba(0,0,0,0.98) 40%, rgba(0,0,0,0.78) 54%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.14) 80%, transparent 92%)",
      }}
    >
      <defs>
        <pattern
          id="surveyGraphGrid"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 16 0 L 0 0 0 16"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="0.6"
          />
        </pattern>
        <marker
          id="graphArrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#cbd5e1" />
        </marker>
        <filter
          id="graphNodeShadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="2"
            floodColor="#64748b"
            floodOpacity="0.18"
          />
        </filter>
      </defs>

      <rect width="840" height="560" fill="#f3f4f6" />
      <rect width="840" height="560" fill="url(#surveyGraphGrid)" />

      {/* Main spine + branch connectors */}
      <g
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="1.5"
        markerEnd="url(#graphArrow)"
      >
        <path d="M420 62 V88" />
        <path d="M420 124 V150" />
        <path d="M420 186 V204 H300 V228" />
        <path d="M420 204 H420 V228" />
        <path d="M420 204 H540 V228" />
        <path d="M300 264 V280 H420 V296" />
        <path d="M420 264 V280" />
        <path d="M540 264 V280 H420" />
        <path d="M420 332 V358" />
        <path d="M420 394 V412 H330 V436" />
        <path d="M420 412 H510 V436" />
        <path d="M330 472 V488 H420 V504" />
        <path d="M510 472 V488 H420" />
        <path d="M420 540 V556" />
      </g>

      <SurveyGraphNode
        x={nodeX}
        y={26}
        width={nodeW}
        label="What is your name?"
        iconColor="#2563eb"
        icon={
          <g fill="#ffffff">
            <circle cx="8" cy="6" r="4" />
            <path d="M2 16c0-4 3-6 6-6s6 2 6 6" />
          </g>
        }
      />
      <SurveyGraphNode
        x={nodeX}
        y={88}
        width={nodeW}
        label="What is your email address?"
        iconColor="#2563eb"
        icon={
          <g fill="none" stroke="#ffffff" strokeWidth="1.5">
            <rect x="2" y="5" width="12" height="9" rx="1" />
            <path d="M2 6 L8 11 L14 6" />
          </g>
        }
      />
      <SurveyGraphNode
        x={nodeX}
        y={150}
        width={nodeW}
        label="Which Atoll do you reside on?"
        iconColor="#16a34a"
        icon={
          <g stroke="#ffffff" strokeWidth="1.5">
            <path d="M3 6h10M3 10h10M3 14h7" />
          </g>
        }
      />

      {/* Branch: island follow-ups */}
      <SurveyGraphNode
        x={176}
        y={228}
        width={208}
        label="Which island of ADh atoll…"
        iconColor="#16a34a"
        icon={
          <g stroke="#ffffff" strokeWidth="1.5">
            <path d="M3 6h10M3 10h10M3 14h7" />
          </g>
        }
      />
      <SurveyGraphNode
        x={316}
        y={228}
        width={208}
        label="Which island of V atoll…"
        iconColor="#16a34a"
        icon={
          <g stroke="#ffffff" strokeWidth="1.5">
            <path d="M3 6h10M3 10h10M3 14h7" />
          </g>
        }
      />
      <SurveyGraphNode
        x={456}
        y={228}
        width={208}
        label="Which island of AA atoll…"
        iconColor="#16a34a"
        icon={
          <g stroke="#ffffff" strokeWidth="1.5">
            <path d="M3 6h10M3 10h10M3 14h7" />
          </g>
        }
      />

      <SurveyGraphNode
        x={nodeX}
        y={296}
        width={nodeW}
        label="What sectors do you represent?"
        iconColor="#dc2626"
        icon={
          <g fill="none" stroke="#ffffff" strokeWidth="1.4">
            <path d="M8 4v12M4 8h8" />
            <path d="M3 16h10" />
            <circle cx="5" cy="6" r="2" />
            <circle cx="11" cy="6" r="2" />
          </g>
        }
      />
      <SurveyGraphNode
        x={nodeX}
        y={358}
        width={nodeW + 24}
        label="Are you willing to answer follow-up…"
        iconColor="#16a34a"
        icon={
          <g fill="none" stroke="#ffffff" strokeWidth="2">
            <path d="M4 8l3 3 6-7" />
          </g>
        }
      />

      <GraphEdgeLabel x={365} y={424} label="= true" />
      <GraphEdgeLabel x={475} y={424} label="default" />
      <GraphEdgeLabel x={420} y={478} label="<Blank:" />

      <SurveyGraphNode
        x={206}
        y={436}
        width={168}
        label="Your Age"
        iconColor="#991b1b"
        icon={
          <text
            x="4"
            y="14"
            fill="#ffffff"
            fontSize="13"
            fontWeight="600"
            style={{ fontFamily: "ui-sans-serif, system-ui" }}
          >
            +/−
          </text>
        }
      />
      <SurveyGraphNode
        x={466}
        y={436}
        width={198}
        label="General Comments"
        iconColor="#2563eb"
        icon={
          <text
            x="5"
            y="15"
            fill="#ffffff"
            fontSize="14"
            fontWeight="600"
            style={{ fontFamily: "Georgia, serif" }}
          >
            ¶
          </text>
        }
      />

      <g filter="url(#graphNodeShadow)">
        <rect
          x={nodeX + 24}
          y={504}
          width={nodeW - 48}
          height={36}
          rx="4"
          fill="#ffffff"
          stroke="#d1d5db"
          strokeWidth="1"
        />
        <text
          x={cx}
          y={526}
          textAnchor="middle"
          fontSize="12"
          fill="#1f2937"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          🙏 Thank you
        </text>
      </g>
    </svg>
  );
}

type AdditionalFeatureCard = {
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
};

const additionalFeatureCards: AdditionalFeatureCard[] = [
  {
    title: "Export to CSV & GeoJSON",
    description:
      "Download non-spatial responses as CSV and spatial answers as GeoJSON, ready for GIS, R, or custom analysis workflows.",
    icon: <DownloadIcon className="h-5 w-5" />,
    iconClassName: "bg-sky-100 text-sky-700 ring-sky-200",
  },
  {
    title: "Data sharing agreements and consent",
    description:
      "Collect informed consent with versioned PDF agreements. SeaSketch tracks which version each participant accepted.",
    icon: <LockClosedIcon className="h-5 w-5" />,
    iconClassName: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  {
    title: "Practice responses",
    description:
      "Let facilitators rehearse the survey flow in practice mode before collecting real responses, then exclude practice data from exports.",
    icon: <PlayIcon className="h-5 w-5" />,
    iconClassName: "bg-violet-100 text-violet-700 ring-violet-200",
  },
  {
    title: "Customizable appearance",
    description:
      "Choose background images, color palettes, and split-screen layouts so every survey feels polished and on-brand for your region.",
    icon: <ImageIcon className="h-5 w-5" />,
    iconClassName: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  },
  {
    title: "Offline data collection",
    description:
      "Our team has experience facilitating surveys in remote areas, and we've built tools to collect data and even view cached maps when offline. Contact us to learn more about using SeaSketch beyond network connectivity.",
    icon: <StatusOfflineIcon className="h-5 w-5" />,
    iconClassName: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  },
  {
    title: "Demographic questions",
    description:
      "Collect participant counts and demographic breakdowns for individuals or groups, supporting inclusive representation in analysis.",
    icon: <UserGroupIcon className="h-5 w-5" />,
    iconClassName: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  },
  {
    title: "Facilitator tracking",
    description:
      "Enable facilitated responses so coordinators can enter answers on behalf of participants and record facilitator names for every submission.",
    icon: <Pencil2Icon className="h-5 w-5" />,
    iconClassName: "bg-amber-100 text-amber-700 ring-amber-200",
  },
];

export default function OceanUseSurveysPage() {
  return (
    <main className="overflow-x-hidden bg-slate-950 text-slate-100">
      <Helmet>
        <title>{`SeaSketch | ${oceanUseSurveysUseCase.title}`}</title>
        <link
          rel="canonical"
          href={`https://www.seasketch.org${oceanUseSurveysUseCase.to}`}
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
              Ocean Use Surveys
            </span>
            <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-6xl">
              Collect{" "}
              <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                local knowledge
              </span>{" "}
              to inform decisions
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Design inclusive spatial surveys that capture how communities use
              the ocean. Run multi-language campaigns with ease, on any device.
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

          <SurveyDeviceMontage layout="hero" />
        </div>
      </section>

      {/* Feature rows */}
      <section className="relative rounded-t-[2.5rem] bg-gradient-to-b from-white to-slate-100 pt-12 text-slate-900 md:pt-16 lg:pt-24">
        <div className="mx-auto max-w-6xl space-y-16 px-4 pb-12 sm:px-6 md:space-y-20 lg:space-y-28 lg:px-8 lg:pb-12">
          {/* Build Surveys */}
          <section className="relative grid items-center gap-8 md:grid-cols-[1fr_minmax(0,1.1fr)] md:gap-20">
            <div className={`${featureCopyPanelClass} order-2 md:order-1`}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <DocumentTextIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Survey design
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Build Surveys
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  SeaSketch&apos;s advanced survey builder supports dozens of
                  question types—from multiple choice and demographics to
                  spatial data input. It has many of the same features as
                  commercial survey builders, plus dedicated tools for capturing
                  spatial data on the map.
                </p>
                <p>
                  Define skip logic and branching with a visual flow diagram, so
                  participants only see the questions relevant to them.
                  Customize welcome screens with beautiful background images and
                  color palettes. Surveys in SeaSketch can be customized to fit
                  your region and visual identity.
                </p>
                <p>
                  <a
                    href="https://docs.seasketch.org/seasketch-documentation/administrators-guide/surveys"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    Read the survey documentation
                  </a>
                </p>
              </div>
            </div>

            <div className="relative z-10 order-1 overflow-hidden md:order-2 md:overflow-visible md:pl-4 lg:pl-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-y-8 -left-8 -right-8 md:-inset-y-24 md:-left-80 md:-right-28 opacity-70"
              >
                <SkipLogicFlowBackground />
              </div>

              <div className="relative mx-auto w-full max-w-[520px]">
                <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-2xl ring-1 ring-slate-200/70">
                  <img
                    src={SURVEY_EDITOR_IMAGE}
                    alt="SeaSketch survey editor showing form elements, appearance settings, and the Add to survey menu"
                    loading="lazy"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Understand Ocean Uses Spatially */}
          <section className="grid items-center gap-8 md:grid-cols-2 md:gap-20 lg:gap-24">
            <div className="relative md:pr-6">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-emerald-400/25 blur-3xl"
              />
              <div className="relative mx-auto max-w-[620px]">
                <div className="relative z-10 overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-2xl ring-1 ring-slate-200/70">
                  <img
                    src={SECTORS_AZORES_IMAGE}
                    alt="Blue Azores Ocean Use Survey sector selection question"
                    loading="lazy"
                    className="w-full"
                  />
                </div>
                <div className="max-md:relative max-md:top-auto max-md:right-auto max-md:mt-4 max-md:w-full max-md:max-w-none absolute -right-6 bottom-[-1.5rem] z-20 w-[42%] max-w-[200px] sm:max-w-[220px] md:-right-10 md:bottom-[-2rem] md:w-[48%] md:max-w-[240px] lg:-right-12">
                  <img
                    src={PHONE_DIGITIZING_IMAGE}
                    alt="Participant drawing a polygon on a map using the mobile survey interface"
                    loading="lazy"
                    className="w-full drop-shadow-2xl"
                  />
                </div>
              </div>
            </div>
            <div className={`${featureCopyPanelClass} md:ml-4 lg:ml-6`}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <MapIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Spatial data collection
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Understand ocean uses spatially and by sector
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Ask participants which sectors they represent—commercial
                  fishing, tourism, research, and more—then guide them through
                  sector-specific spatial questions. Skip logic ensures each
                  person only maps the activities that apply to them.
                </p>
                <p>
                  Participants draw points, lines, and polygons directly on the
                  map to show where they work, research, and value the ocean.
                  Responses export as spatial data, ready for analysis in
                  desktop GIS.
                </p>
              </div>
            </div>
          </section>

          {/* Multi-language — image right */}
          <section className="relative grid items-center gap-8 md:grid-cols-[1fr_minmax(0,1.05fr)] md:gap-20">
            <div className={`${featureCopyPanelClass} order-2 md:order-1`}>
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <GlobeIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Localization
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Run multi-language campaigns
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  SeaSketch was developed for use globally from the start, with
                  support for multiple languages out of the box. When authoring
                  content for your survey, you can provide questions in multiple
                  languages, including right-to-left scripts.
                </p>
                <p>
                  Language pickers appear throughout the survey experience, so
                  participants and facilitators can switch languages at any time
                  during a session.
                </p>
              </div>
            </div>

            <div className="relative z-10 order-1 overflow-hidden md:order-2 md:overflow-visible md:pl-4 lg:pl-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-y-8 -left-8 -right-8 md:-inset-y-24 md:-left-80 md:-right-28"
              >
                <ReefFeatheredBackdrop />
              </div>

              <div className="relative mx-auto flex min-h-[280px] w-full max-w-[440px] items-center justify-center py-8 md:min-h-[320px]">
                <SurveyLanguagePickerDemo />
              </div>
            </div>
          </section>

          {/* Desktop, mobile, and offline — image left */}
          <section className="grid items-center gap-8 md:grid-cols-2 md:gap-20 lg:gap-24">
            <div className="relative order-2 overflow-visible md:order-1 md:pr-4">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-sky-400/25 blur-3xl"
              />
              <SurveyDeviceMontage layout="feature" />
            </div>
            <div
              className={`${featureCopyPanelClass} order-1 md:order-2 md:ml-4 lg:ml-6`}
            >
              <div className="inline-flex items-center gap-2 text-sky-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                  <MobileIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Anywhere access
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Desktop or mobile, facilitated or self-guided
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Surveys work great on laptops, tablets, and phones. Mobile
                  digitizing includes a magnifier and inset map for precise
                  spatial input on small screens.
                </p>
                <p>
                  Surveys can be self-guided by anyone without an account, or
                  directly facilitated by your team. Facilitator tracking and
                  practice modes are built-in, and duplicate response detection
                  is implemented without storing or exposing IP addresses.
                </p>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-4xl px-2">
            <Testimonial
              quote={HULWA_QUOTE}
              author="Hulwa Khaleel"
              affiliation="Lead Coordinator, Noo Raajje OUS"
              headshotSrc={HULWA_HEADSHOT}
            />
          </div>
        </div>
      </section>

      {/* Additional features */}
      <section className="bg-slate-100 text-slate-900">
        <div className="mx-auto mb-4 max-w-6xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/85 shadow-sm ring-1 ring-white/50 backdrop-blur-sm">
            <div className="p-6 md:p-10">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Actionable insights
              </div>
              <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Collect essential spatial data for ocean planning
              </h2>
              <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">
                Our team has used these tools to inform participatory processes
                around the world. A community&apos;s valued spaces are captured
                as spatial data, prioritized, and can be transformed into
                heatmaps for visualization and the evaluation of marine spatial
                plans. This information can be used to see who is impacted by
                these decisions, and ensure equitable outcomes.
              </p>
              <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">
                To support this work, we&apos;ve built open-source tools in R
                that can be used to track a survey campaign and generate
                heatmaps from ocean use survey data.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5 md:gap-3">
                {actionableInsightLinks.map((item) => {
                  const pillClassName =
                    "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/70 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 hover:ring-sky-200";

                  if (item.external) {
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className={pillClassName}
                      >
                        {item.icon}
                        {item.label}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      to={item.href}
                      className={pillClassName}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-200/80">
              <img
                src={OUS_HEATMAP_FOOTER}
                alt=""
                aria-hidden
                className="h-36 w-full object-cover object-center md:h-44 lg:h-48 shadow-inner"
              />
            </div>
          </div>

          <div className="mt-12">
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
            Ready to launch your Ocean Use Survey?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Create a free project and start designing a spatial survey today.
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
