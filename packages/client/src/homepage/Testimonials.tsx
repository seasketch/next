/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { EmblaCarouselType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import WheelGesturesPlugin from "embla-carousel-wheel-gestures";
import { Link } from "react-router-dom";

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
  caseStudyPath?: string;
  caseStudyLabel?: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    headshotSrc:
      "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/a9c4e662-db48-4873-d2d2-ed39e271ee00/thumbnail",
    person: {
      name: "Marinez Scherer",
      degrees: ["Ph.D."],
      title: "Professor",
      affiliation: "Federal University of Santa Catarina",
      additionalRoles: ["Envoy for the Ocean, COP30"],
    },
    quote:
      "SeaSketch enabled collaboration across government, science, and communities in Brazil like no other tool could.",
    caseStudyPath: "/case-studies/brazil",
    caseStudyLabel: "Read about the Brazil project",
  },
  {
    headshotSrc:
      "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/bc1c9ae6-95f0-496b-6d4e-6b7afd419d00/thumbnail",
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
    headshotSrc:
      "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/829c5443-7af4-4f6a-ccde-8bcc5488ff00/thumbnail",
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
    headshotSrc:
      "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/c95d9456-b8eb-4d8f-ae1b-9bb1edc79d00/thumbnail",
    person: {
      name: "Tazmin Falan",
      affiliation: "Blue Prosperity Micronesia",
    },
    quote:
      "SeaSketch is a user-friendly, interactive tool that empowers community members to map their ocean uses, even offline in remote areas. The data collected through SeaSketch has been invaluable for creating heat maps that guide fisheries management by communities and government alike",
    caseStudyPath: "/case-studies/fsm",
    caseStudyLabel: "Read about the FSM project",
  },
  {
    headshotSrc:
      "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/f37c657b-96d2-4861-6365-45a6367e8300/thumbnail",
    person: {
      name: "Hulwa Khaleel",
      title: "Lead Coordinator",
      affiliation: "Noo Raajje Ocean Use Survey",
    },
    quote:
      "The Ocean Use Survey gave voice to thousands of Maldivians whose lives and livelihoods depend on the sea. With SeaSketch, we were able to capture this indigenous knowledge at a national scale for the first time, and turn it into a living resource of maps and interactive data that we, and others, can continue to analyze to inform decision making and ensure community perspectives shape ocean planning.",
    caseStudyPath: "/case-studies/maldives",
    caseStudyLabel: "Read about the Maldives project",
  },
  {
    headshotSrc:
      "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/f2592a25-20d6-4b01-4cd3-5981d41b6700/thumbnail",
    person: {
      name: "Catherine Paul",
      affiliation: "Ministry of Fisheries and Ocean Resources, Kiribati",
    },
    quote:
      "In just a few days, we went from scattered files to a national platform we can use for planning and decision-making. SeaSketch showed us that building a geoportal doesn’t have to take years—it can start today.",
    caseStudyPath: "/case-studies/kiribati",
    caseStudyLabel: "Read about the Kiribati project",
  },
  {
    headshotSrc:
      "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/d519a37f-22b7-40f2-e998-6f9539be8000/thumbnail",
    person: {
      name: "Adriano Quintela",
      affiliation: "Blue Azores Initiative",
    },
    quote:
      "SeaSketch helped empower our region to design the largest offshore MPA network in the North Atlantic - not just with scientific rigor, but with community voices guiding every boundary.",
    caseStudyPath: "/case-studies/azores",
    caseStudyLabel: "Read about the Azores project",
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
      WheelGesturesPlugin(),
    ]
  );
  const { selectedIndex, scrollSnaps, onDotButtonClick } =
    useDotButton(emblaApi);

  return (
    <section className="relative isolate overflow-hidden bg-slate-50">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-24 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.04),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
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
            <ul className="flex gap-0 space-x-5 px-5">
              {TESTIMONIALS.map((t, i) => (
                <li
                  key={t.person.name}
                  className={`max-w-sm sm:max-w-none min-w-0 text-sm shrink-0 ${
                    t.quote.length > 300
                      ? "w-[540px]"
                      : t.quote.length > 250
                      ? "w-128"
                      : t.quote.length > 200
                      ? "w-[400px]"
                      : "w-[360px]"
                  }`}
                >
                  <figure className="flex h-full flex-col justify-between sm:rounded-md bg-white rounded-none p-6 sm:p-8 ring-0 sm:ring-1 sm:ring-slate-200 shadow-md">
                    <blockquote className="text-slate-800">
                      <svg
                        aria-hidden
                        className="h-6 w-6 text-sky-600"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V22h8.28v-8.28H7.17V11.3c0-1.13.92-2.05 2.05-2.05h1.06V6H7.17Zm9.66 0A5.17 5.17 0 0 0 11.66 11.17V22h8.28v-8.28h-3.11V11.3c0-1.13.92-2.05 2.05-2.05h1.06V6h-3.11Z" />
                      </svg>
                      <p className="mt-3 text-sm md:text-base leading-7 select-none">
                        {t.quote}
                      </p>
                      {t.caseStudyPath && (
                        <div className="mt-3">
                          <a
                            href={t.caseStudyPath}
                            className="inline-flex items-center text-sm font-medium text-sky-700 hover:text-sky-800"
                          >
                            {(t.caseStudyLabel || "Read the case study") + " →"}
                          </a>
                        </div>
                      )}
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
        </div>
        <div className="embla__controls">
          <div className="w-full pt-8 -mb-8">
            <div className="flex items-center space-x-1 mx-auto justify-center">
              {scrollSnaps.map((_, index) => (
                <button
                  className="flex items-center justify-center"
                  onClick={() => onDotButtonClick(index)}
                  key={index}
                >
                  <DotButton
                    selected={index === selectedIndex}
                    className="w-4 h-4 rounded-lg bg-gray-300 hover:bg-gray-400 transition-colors"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type UseDotButtonType = {
  selectedIndex: number;
  scrollSnaps: number[];
  onDotButtonClick: (index: number) => void;
};

export const useDotButton = (
  emblaApi: EmblaCarouselType | undefined
): UseDotButtonType => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const onDotButtonClick = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onInit = useCallback((emblaApi: EmblaCarouselType) => {
    setScrollSnaps(emblaApi.scrollSnapList());
  }, []);

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onInit(emblaApi);
    onSelect(emblaApi);
    emblaApi.on("reInit", onInit).on("reInit", onSelect).on("select", onSelect);
  }, [emblaApi, onInit, onSelect]);

  return {
    selectedIndex,
    scrollSnaps,
    onDotButtonClick,
  };
};

type DotButtonProps = {
  className?: string;
  selected?: boolean;
};

export const DotButton: React.FC<DotButtonProps> = ({
  className,
  selected,
}) => {
  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ scale: selected ? 1 : 0.5 }}
      transition={{
        scale: selected
          ? { type: "spring", stiffness: 600, damping: 18, bounce: 0.35 }
          : { duration: 0.12, ease: "easeOut" },
      }}
    />
  );
};
