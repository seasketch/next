/* eslint-disable i18next/no-literal-string */
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

export const sketchingAndAnalysisUseCase = {
  id: "sketching-and-analysis",
  to: "/uses/sketching-and-analysis",
  title: "Sketching and Analysis",
  navLabel: "Sketching and Analysis",
  readMoreLabel: "Read more about Sketching and Analysis",
  summary:
    "Easy to use design and analysis tools empower stakeholders to effectively participate in a science-driven planning process.",
  bullets: [
    "Sketch zones and planning options",
    "Evaluate scenarios against spatial objectives",
    "Export results for GIS and reporting workflows",
  ],
};

export default function SketchingAndAnalysisPage() {
  return (
    <main>
      <Helmet>
        <title>{`SeaSketch | ${sketchingAndAnalysisUseCase.title}`}</title>
        <link
          rel="canonical"
          href={`https://www.seasketch.org${sketchingAndAnalysisUseCase.to}`}
        />
      </Helmet>
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 py-16 text-slate-900 lg:py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-300/18 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.06),transparent)]" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/#use-cases"
            className="text-sm font-medium text-sky-700 hover:text-sky-900"
          >
            Back to SeaSketch capabilities
          </Link>
          <div className="mt-8 max-w-3xl">
            <span className="text-xs uppercase tracking-[0.2em] text-sky-700/80">
              SeaSketch use case
            </span>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              {sketchingAndAnalysisUseCase.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-700">
              {sketchingAndAnalysisUseCase.summary}
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {sketchingAndAnalysisUseCase.bullets.map((bullet) => (
              <div
                key={bullet}
                className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur"
              >
                <h2 className="text-base font-semibold text-slate-900">
                  {bullet}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Placeholder content for this section can be expanded with
                  examples, screenshots, and customer stories.
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Page draft placeholder
            </h2>
            <p className="mt-3 max-w-3xl text-slate-700">
              This page is ready to be fleshed out with detailed positioning,
              visuals, feature walkthroughs, and calls to action for this
              SeaSketch use case.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
