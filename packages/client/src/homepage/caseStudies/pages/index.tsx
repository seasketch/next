/* eslint-disable i18next/no-literal-string */
import React from "react";
import { Link } from "react-router-dom";

const studies = [
  {
    to: "/case-studies/azores",
    title: "Blue Azores",
    img: "/caseStudies/azores-hero.png",
  },
  {
    to: "/case-studies/belize",
    title: "Belize",
    img: "/caseStudies/belize-hero.jpg",
  },
  {
    to: "/case-studies/brazil",
    title: "Brazil",
    img: "/caseStudies/brazil-hero.jpg",
  },
  {
    to: "/case-studies/california",
    title: "California",
    img: "/caseStudies/california-hero.png",
  },
  {
    to: "/case-studies/fsm",
    title: "Federated States of Micronesia",
    img: "/caseStudies/fsm-hero.jpg",
  },
  {
    to: "/case-studies/kiribati",
    title: "Kiribati",
    img: "/caseStudies/kiribati-hero.jpg",
  },
  {
    to: "/case-studies/maldives",
    title: "Maldives",
    img: "/caseStudies/maldives-hero.jpg",
  },
];

export default function CaseStudiesIndex() {
  return (
    <>
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-950"></div>
      <main className="bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
        <section className="relative mx-auto max-w-6xl px-6 py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.04),transparent)]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold">
            SeaSketch Case Studies
          </h1>
          <p className="mt-3 text-slate-700 max-w-3xl">
            Explore how SeaSketch supports participatory, transparent, and
            science-informed ocean planning around the world.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {studies.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white/80 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 backdrop-blur"
              >
                <div className="relative h-40 w-full">
                  <img
                    src={s.img}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10" />
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {s.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Read the story →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
