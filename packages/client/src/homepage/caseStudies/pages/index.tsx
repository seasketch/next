/* eslint-disable i18next/no-literal-string */
import React from "react";
import { Link } from "react-router-dom";

const studies = [
  {
    to: "/case-studies/azores",
    title: "Blue Azores",
    img: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/cf32b2eb-bef7-435d-0740-8dfc7b66e900/hthumb",
  },
  {
    to: "/case-studies/belize",
    title: "Belize",
    img: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/d48986b0-11bc-429b-bae8-f079d5af2e00/hthumb",
  },
  {
    to: "/case-studies/brazil",
    title: "Brazil",
    img: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/86de74b7-1d03-4292-59c6-c19bc4bde500/hthumb",
  },
  {
    to: "/case-studies/california",
    title: "California",
    img: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/7366c87c-9ca6-492c-ced1-faf980719b00/hthumb",
  },
  {
    to: "/case-studies/fsm",
    title: "Federated States of Micronesia",
    img: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/52aa1af7-b3f7-486e-b91d-aec08bd66400/hthumb",
  },
  {
    to: "/case-studies/kiribati",
    title: "Kiribati",
    img: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/9f34a0cf-732a-4a70-7cb6-45b126ab8e00/hthumb",
  },
  {
    to: "/case-studies/maldives",
    title: "Maldives",
    img: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/bb5eab11-75d2-4918-d8ac-f40b713cd900/hthumb",
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
