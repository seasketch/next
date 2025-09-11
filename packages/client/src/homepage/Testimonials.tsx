/* eslint-disable i18next/no-literal-string */
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";

export type Testimonial = {
  headshotSrc: string;
  person: {
    name: string;
    degrees?: string[];
    title?: string;
    affiliation?: string;
    additionalRoles?: string[];
  };
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    headshotSrc: "/people/marinez.jpg",
    person: {
      name: "Marinez Scherer",
      degrees: ["Ph.D."],
      title: "Professor",
      affiliation: "Federal University of Santa Catarina",
      additionalRoles: ["Envoy for the Ocean, COP30"],
    },
    quote:
      "SeaSketch enabled collaboration across government, science, and communities in Brazil like no other tool could.",
  },
  {
    headshotSrc: "/people/katheryn.jpg",
    person: {
      name: "Kathryn Mengerink",
      degrees: ["J.D.", "Ph.D."],
      title: "Executive Director",
      affiliation: "Waitt Institute",
    },
    quote:
      "SeaSketch represents the best of what technology can offer to ocean governance—open, inclusive, and grounded in real-world needs.",
  },
  {
    headshotSrc: "/people/joanna.jpg",
    person: {
      name: "Joanna Smith",
      degrees: ["Ph.D.", "RPBio"],
      title: "Director, Ocean Planning and Mapping, Global Project",
      affiliation: "The Nature Conservancy",
    },
    quote:
      "SeaSketch makes it possible for governments, stakeholders, communities, and conservation organisations to work from a common platform for spatial data. It’s one of the most powerful tools we have for ecosystem-based marine planning.",
  },
  {
    headshotSrc: "/people/tazmin.jpg",
    person: {
      name: "Tazmin Falan",
      affiliation: "Blue Prosperity Micronesia",
    },
    quote:
      "SeaSketch is a user-friendly, interactive tool that empowers community members to map their ocean uses, even offline in remote areas. The data collected through SeaSketch has been invaluable for creating heat maps that guide fisheries management by communities and government alike",
  },
  {
    headshotSrc: "/people/hulwa.jpg",
    person: {
      name: "Hulwa Khaleel",
      title: "Lead Coordinator",
      affiliation: "Noo Raajje Ocean Use Survey",
    },
    quote:
      "The Ocean Use Survey gave voice to thousands of Maldivians whose lives and livelihoods depend on the sea. With SeaSketch, we were able to capture this indigenous knowledge at a national scale for the first time, and turn it into a living resource of maps and interactive data that we, and others, can continue to analyze to inform decision making and ensure community perspectives shape ocean planning.",
  },
];

function formatPersonLine(t: Testimonial) {
  const { name, degrees } = t.person;
  if (degrees && degrees.length > 0) {
    return `${name}, ${degrees.join(", ")}`;
  }
  return name;
}

function formatAffiliationLine(t: Testimonial) {
  const parts: string[] = [];
  if (t.person.title) parts.push(t.person.title);
  if (t.person.affiliation) parts.push(t.person.affiliation);
  if (t.person.additionalRoles && t.person.additionalRoles.length > 0) {
    parts.push(...t.person.additionalRoles);
  }
  return parts.join(" • ");
}

export default function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      containScroll: "trimSnaps",
      dragFree: true,
      skipSnaps: true,
    },
    [
      AutoScroll({
        speed: 1,
        stopOnInteraction: true,
        stopOnMouseEnter: true,
      }),
    ]
  );
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const update = () => setActiveIdx(emblaApi.selectedScrollSnap());
    update();
    emblaApi.on("select", update);
    emblaApi.on("reInit", update);
    return () => {
      emblaApi.off("select", update);
      emblaApi.off("reInit", update);
    };
  }, [emblaApi]);

  return (
    <section className="relative isolate overflow-hidden bg-slate-50">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-24 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.04),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl">
          <span className="text-xs uppercase tracking-[0.2em] text-sky-700/80">
            What people are saying
          </span>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
            Trusted by practitioners worldwide
          </h2>
          <p className="mt-3 text-slate-700">
            Leaders from government, NGOs, and academia rely on SeaSketch to
            power collaborative, science‑based ocean planning.
          </p>
        </div>

        <div className="relative mt-10">
          <div
            className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] px-5"
            ref={emblaRef}
          >
            <ul className="flex gap-0 space-x-5">
              {TESTIMONIALS.map((t, i) => (
                <li
                  key={t.person.name}
                  className={`min-w-0 shrink-0 ${
                    t.person.name === "Hulwa Khaleel" ? "w-128" : "w-96"
                  }`}
                >
                  <figure className="flex h-full flex-col justify-between rounded-none sm:rounded-3xl bg-white p-6 sm:p-8 ring-0 sm:ring-1 sm:ring-slate-200 shadow-sm ">
                    <blockquote className="text-slate-800">
                      <svg
                        aria-hidden
                        className="h-6 w-6 text-sky-600"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V22h8.28v-8.28H7.17V11.3c0-1.13.92-2.05 2.05-2.05h1.06V6H7.17Zm9.66 0A5.17 5.17 0 0 0 11.66 11.17V22h8.28v-8.28h-3.11V11.3c0-1.13.92-2.05 2.05-2.05h1.06V6h-3.11Z" />
                      </svg>
                      <p className="mt-3 text-base leading-7 select-none">
                        {t.quote}
                      </p>
                    </blockquote>
                    <figcaption className="mt-6 flex items-center gap-4">
                      <img
                        src={t.headshotSrc}
                        alt={t.person.name}
                        className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
                      />
                      <div>
                        <div className="font-medium text-slate-900">
                          {formatPersonLine(t)}
                        </div>
                        {(t.person.title ||
                          t.person.affiliation ||
                          (t.person.additionalRoles &&
                            t.person.additionalRoles.length > 0)) && (
                          <div className="text-sm text-slate-600">
                            {formatAffiliationLine(t)}
                          </div>
                        )}
                      </div>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to testimonial ${i + 1}`}
                onClick={() => emblaApi?.scrollTo(i)}
                className={
                  i === activeIdx
                    ? "h-2.5 w-6 rounded-full bg-slate-700 transition-all"
                    : "h-1.5 w-1.5 rounded-full bg-slate-300 hover:bg-slate-400 transition-colors"
                }
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
