import Badge from "../components/Badge";
import LightRays from "./LightRays";
import Testimonials from "./Testimonials";
import WhereWeWork from "./WhereWeWork";

export type TrustedPartnerLogo = {
  alt: string;
  src: string;
  url: string;
};

const logos = [
  {
    alt: "Waitt Institute",
    src: "/logos/waitt.webp",
    url: "https://www.waittinstitute.org/",
  },
  {
    alt: "Blue Prosperity Coalition",
    src: "/logos/BPCLogo3.png",
    url: "https://www.blueprosperity.org/",
  },
  {
    alt: "The Nature Conservancy",
    src: "/logos/tnc.svg",
    url: "https://nature.org",
  },
  {
    alt: "Oceans 5",
    src: "/logos/oceans-5.png",
    url: "https://oceans5.org/",
  },
  {
    alt: "Oceano Azul",
    src: "/logos/OA.webp",
    url: "https://oceanoazulfoundation.org/",
  },
  {
    alt: "California Ocean Protection Council",
    src: "/logos/OPC.png",
    url: "https://opc.ca.gov/",
  },
] as TrustedPartnerLogo[];

/* eslint-disable i18next/no-literal-string */
export default function LandingPage() {
  return (
    <>
      {/* <style>{`
        @keyframes blob {
          0% { transform: translate(0,0) scale(1); }
          33% { transform: translate(20px,-30px) scale(1.05); }
          66% { transform: translate(-15px,20px) scale(0.98); }
          100% { transform: translate(0,0) scale(1); }
        }
        .animate-blob { animation: blob 9s ease-in-out infinite; will-change: transform; }
        @keyframes pulseOpacity { 0%,100% { opacity: 0.25; } 50% { opacity: 0.45; } }
        .animate-pulse-slow { animation: pulseOpacity 14s ease-in-out infinite; }
      `}</style> */}
      {/* Header (glass, minimal) */}

      {/* <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/60 backdrop-blur supports-[backdrop-filter]:bg-slate-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a
            href="#home"
            aria-label="SeaSketch home"
            className="flex items-center gap-3"
          >
            <img
              src="/mnt/data/seasketch-logo.c4d8745d-1.png"
              alt="SeaSketch logo"
              className="h-8 w-8"
            />
            <span className="font-semibold tracking-tight">SeaSketch</span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-200">
            <a href="#projects" className="hover:text-white">
              Projects
            </a>
            <div className="relative group">
              <button className="hover:text-white">Use Cases</button>
              <div className="absolute hidden group-hover:block bg-slate-900/95 border border-white/10 rounded-xl shadow-lg p-3 w-56 mt-2">
                <a href="#use-cases" className="block py-1.5 hover:text-white">
                  Data Portal
                </a>
                <a href="#use-cases" className="block py-1.5 hover:text-white">
                  Ocean Use Surveys
                </a>
                <a href="#use-cases" className="block py-1.5 hover:text-white">
                  Planning Tools
                </a>
              </div>
            </div>
            <a href="#funders" className="hover:text-white">
              Funders & Partners
            </a>
            <a href="#about" className="hover:text-white">
              About
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="/new-project"
              className="inline-flex items-center rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
            >
              Create a project
            </a>
          </div>
        </div>
      </header> */}

      {/* Hero: gradient mesh + command bar */}
      <section id="home" className="relative isolate overflow-hidden">
        {/* Mesh background */}
        <div className="absolute inset-0 -z-10">
          <LightRays
            raysOrigin="top-center"
            raysColor="#00ffff"
            raysSpeed={0.5}
            lightSpread={1}
            rayLength={1.2}
            followMouse={true}
            mouseInfluence={0.05}
            noiseAmount={0.1}
            distortion={0.05}
            className="custom-rays"
          />
          <div
            className="absolute bottom-0 left-0 w-full h-full"
            style={{
              background: "url(/logos/seafloor-4.jpg) center bottom no-repeat",
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.9) 100%)",
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.9) 100%)",
            }}
          ></div>
          <div
            className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-500/30 blur-3xl animate-blob"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="absolute top-1/3 -right-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl animate-blob"
            style={{ animationDelay: "3s" }}
          />
          <div
            className="absolute bottom-0 left-[20%] h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl animate-blob"
            style={{ animationDelay: "6s" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,255,255,0.08),transparent)] animate-pulse-slow" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-white leading-tight">
            <em className="italic">The</em> platform for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-300 block pb-2">
              Marine Spatial Planning
            </span>
          </h1>
          <p className="mt-4 text-lg/7 text-slate-300 max-w-2xl mx-auto">
            <span className="sm:block">
              Publish maps, survey stakeholders, and design better plans.{" "}
            </span>
            <span>
              Built to help countries deliver on{" "}
              <span className="whitespace-nowrap">30×30</span> commitments.
            </span>
          </p>

          {/* Command bar */}
          <form
            action="/projects"
            className="mt-8 flex items-center justify-center"
          >
            <div className="flex w-full max-w-xl items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
              <input
                name="q"
                placeholder="Search for a project…"
                className="ml-2 flex-1 bg-transparent outline-none placeholder:text-slate-400 text-slate-100 focus:ring-0 border-none"
              />
              <button
                type="submit"
                className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium ring-1 ring-inset ring-white/20 text-white hover:bg-white/10"
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/new-project"
              className="inline-flex items-center rounded-full bg-primary-500/30 ring-1 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-500/20"
            >
              Create a project
            </a>
            <a
              href="mailto:support@seasketch.org"
              className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium ring-1 ring-inset ring-white/20 text-white hover:bg-white/10"
            >
              Request a demo
            </a>
          </div>
        </div>
      </section>

      {/* Social proof ribbon */}
      <section className="py-10 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-slate-400">
            Trusted by governments, NGOs, and research institutions
          </p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 items-center opacity-80">
            {[
              ...logos.map((logo) => (
                <div className="group flex items-center justify-center hover:grayscale-0 grayscale">
                  <a
                    className="w-32 h-12 flex items-center"
                    href={logo.url}
                    key={logo.alt}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      filter: "contrast(0.3) brightness(1.5)",
                      background: `url(${logo.src}) center center no-repeat`,
                      backgroundSize: "contain",
                    }}
                  >
                    {""}
                  </a>
                </div>
              )),
            ]}
          </div>
        </div>
      </section>

      {/* Use Cases: 3 alternating feature rows */}
      <section id="use-cases" className="py-16 bg-white text-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-xs uppercase tracking-[0.2em] text-sky-700/80">
              Capabilities
            </span>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">
              What can SeaSketch do?
            </h2>
            <p className="mt-3 text-slate-700">
              Three powerful modules can work alone or together as a
              comprehensive tool for stakeholder-driven ocean planning.
            </p>
          </div>

          {/* Row 1 */}
          <div className="mt-14 grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-6">
              <div className="aspect-[4/3] rounded-3xl  grid place-items-center text-xs text-slate-500">
                <img
                  src="/map-portal-screenshot.png"
                  alt="Map Portal"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="md:col-span-6">
              <h3 className="text-2xl font-semibold">
                Publish Your Map Portal
              </h3>
              <p className="mt-2 text-slate-700">
                Host, visualize, and share spatial data. Create a common picture
                of your ocean environment.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>Upload and host vector or raster data</li>
                <li>
                  Create beautiful maps with our easy to use cartography tools
                </li>
                <li>Role‑based access & sharing</li>
                <li>Metadata and version control</li>
                <li>Integrates with Esri and open-source services</li>
              </ul>
              <a
                href="/uses/map-portal"
                className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
              >
                Learn more →
              </a>
            </div>
          </div>

          {/* Row 2 */}
          <div className="mt-14 grid items-center gap-10 md:grid-cols-12">
            <div className="md:order-2 md:col-span-6">
              <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-emerald-50 to-slate-50 ring-1 ring-slate-200 grid place-items-center text-xs text-slate-500">
                Surveys image
              </div>
            </div>
            <div className="md:order-1 md:col-span-6">
              <h3 className="text-2xl font-semibold">
                Conduct Ocean Use Surveys
              </h3>
              <p className="mt-2 text-slate-700">
                Collect local knowledge directly on the map—structured, spatial,
                analysis‑ready. Run multi‑language campaigns with ease.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>Advanced survey builder</li>
                <li>
                  Multi-language capable with built-in support for right-to-left
                  languages
                </li>
                <li>Offline data collection</li>
                <li>Understand ocean uses by sector</li>
              </ul>
              <a
                href="/uses/surveys"
                className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
              >
                Learn more →
              </a>
            </div>
          </div>

          {/* Row 3 */}
          <div className="mt-14 grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-6">
              <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-indigo-50 to-slate-50 ring-1 ring-slate-200 grid place-items-center text-xs text-slate-500">
                Participatory Planning
              </div>
            </div>
            <div className="md:col-span-6">
              <h3 className="text-2xl font-semibold">
                Design and Evaluate Scenarios
              </h3>
              <p className="mt-2 text-slate-700">
                Easy to use design and analysis tools empower stakeholders to
                effectively participate in a science-driven planning process.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>Scenario design & sketching</li>
                <li>Powerful spatial overlay analysis tools</li>
                <li>Fast, intuitive reports on progress towards objectives</li>
                <li>Online collaboration tools and discussion forums</li>
              </ul>
              <a
                href="/uses/planning"
                className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
              >
                Learn more →
              </a>
            </div>
          </div>
        </div>
      </section>
      <Testimonials />
      <section
        id="thirtyxthirty"
        className="relative overflow-hidden py-20 bg-gradient-to-b from-slate-100 to-slate-300 text-slate-900 sm:px-12"
      >
        {/* Decorative background */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.04),transparent)]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-700/80">
              Vision
            </span>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">
              Built for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-emerald-600">
                30×30
              </span>
            </h2>
            <p className="mt-3 text-slate-700">
              From data to decision-making, SeaSketch supports each step of
              30×30 marine protection planning.
            </p>
          </div>

          <div className="mt-12 grid gap-10 md:grid-cols-12 md:gap-12">
            {/* Stepper */}
            <div className="relative md:col-span-12">
              <div
                aria-hidden
                className="absolute left-4 top-6 bottom-6 w-px bg-sky-200/70"
              />
              <ol className="space-y-6 text-sm">
                {[
                  {
                    t: "Centralize Data",
                    d: "Bring together critical data in the accessible, intuitive data portal",
                  },
                  {
                    t: "Engage & Survey",
                    d: "Gather essential spatial data with Ocean Use Surveys",
                  },
                  {
                    t: "Co‑design Plans",
                    d: "Collaboratively design and evaluate zones",
                  },
                  {
                    t: "Publish & Share",
                    d: "Communicate draft and finalized plans to stakeholders",
                  },
                  {
                    t: "Monitor",
                    d: "Update datasets and revise plans to support adaptive management",
                  },
                ].map((s, i) => (
                  <li key={s.t} className="relative pl-8">
                    <div className="rounded-2xl bg-white/70 ring-1 ring-slate-200 backdrop-blur px-6 py-3 flex items-center gap-4">
                      <span className="inline-block leading-none text-2xl md:text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-b from-blue-800/90 to-sky-600/60">
                        {i + 1}
                      </span>
                      <span
                        aria-hidden
                        className="mx-1 h-8 w-px bg-slate-200/70"
                      />
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {s.t}
                        </h3>
                        <p className="mt-1 text-slate-700">{s.d}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* <div className="mt-10 flex flex-wrap gap-2 text-xs">
            {["Open Source", "Trusted Globally", "Built for Teams"].map(
              (tag) => (
                <Badge key={tag} variant="primary">
                  {tag}
                </Badge>
                // <span
                //   key={tag}
                //   className="rounded-full bg-white text-slate-700 ring-1 ring-slate-200 px-3 py-1"
                // >
                //   {tag}
                // </span>
              )
            )}
          </div> */}
        </div>
      </section>

      {/* Where we work */}
      <WhereWeWork
        onBBoxCallback={(bbox) => {
          // Use the map created inside WhereWeWork via global hook
          // @ts-ignore
          const map = (window as any).newMap;
          if (map && !map._removed) {
            map.fitBounds(
              [
                [bbox[0], bbox[1]],
                [bbox[2], bbox[3]],
              ],
              { padding: 80, duration: 800 }
            );
          }
        }}
      />

      {/* Impact band */}
      <section className="relative overflow-hidden py-20 bg-slate-900 text-slate-100">
        {/* Subtle topo linework background */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 mix-blend-overlay"
          viewBox="0 0 1200 600"
        >
          <g
            fill="none"
            stroke="#7dd3fc"
            strokeOpacity="1"
            strokeWidth="1.2"
            strokeLinecap="round"
          >
            <path d="M -50 110 C 120 90, 300 140, 520 120 S 940 90, 1250 110" />
            <path d="M -50 150 C 100 130, 320 180, 540 150 S 960 130, 1250 150" />
            <path d="M -50 195 C 80 180, 340 210, 560 185 S 980 175, 1250 195" />
            <path d="M -50 235 C 60 220, 360 250, 580 230 S 1000 225, 1250 235" />
            <path d="M -50 275 C 40 265, 380 290, 600 275 S 1020 265, 1250 275" />
          </g>
          <g
            fill="none"
            stroke="#a7f3d0"
            strokeOpacity="1"
            strokeWidth="1"
            strokeLinecap="round"
          >
            <path d="M -50 330 C 100 350, 340 320, 560 340 S 980 360, 1250 335" />
            <path d="M -50 370 C 110 390, 350 355, 570 380 S 990 395, 1250 375" />
            <path d="M -50 410 C 120 430, 360 395, 580 420 S 1000 430, 1250 415" />
          </g>
        </svg>
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 text-center">
            {[
              { n: "16", l: "years of innovation" },
              { n: "100,000", l: "polygons drawn and analyzed" },
              { n: "20+", l: "countries" },
              { n: "10+ million", l: "square kilometers of ocean evaluated" },
              { n: "10,000+", l: "map layers hosted" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-4xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-emerald-300">
                  {s.n}
                </div>
                <div className="mt-1 text-sm text-slate-300 capitalize">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
