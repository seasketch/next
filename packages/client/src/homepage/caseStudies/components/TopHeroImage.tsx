/* eslint-disable i18next/no-literal-string */
import React from "react";
import { FeatureCardItem } from "./FeatureCardList";

export interface TopHeroImageProps {
  title: string;
  subtitle?: string;
  imageUrl: string;
  projectUrl: string;
  projectLabel?: string;
  featureTitle?: string;
  featureItems?: FeatureCardItem[];
}

export default function TopHeroImage(props: TopHeroImageProps) {
  const {
    title,
    subtitle,
    imageUrl,
    projectUrl,
    projectLabel,
    featureTitle,
    featureItems,
  } = props;
  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative h-[50vh] min-h-[540px] w-full">
        <img
          src={imageUrl}
          alt="Case study hero"
          className="absolute inset-0 h-full w-full object-cover object-top"
          style={{
            objectPosition: "25% 25%",
          }}
        />
        {/* Base soft overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-slate-900/10" />
        {/* Deepen bottom for readability of horizontal features */}
        <div
          className={`absolute inset-x-0 bottom-0 h-96 md:h-72 ${
            featureItems && featureItems.length > 0 ? "bottom-48" : "bottom-0"
          }`}
          style={{
            background:
              "linear-gradient(to top, rgba(15, 23, 42, 1), transparent)",
          }}
        />
        {featureItems && featureItems.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-48 md:h-48 bg-slate-900" />
        )}

        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-5xl px-6 py-8">
          <div className="flex flex-col gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white drop-shadow">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 max-w-3xl text-slate-100/90 text-lg md:text-xl">
                  {subtitle}
                </p>
              ) : null}
              <a
                href={projectUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-base sm:text-lg font-bold text-white shadow-lg hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300/70 focus:ring-offset-2 focus:ring-offset-slate-900 transition"
              >
                {projectLabel || "Open project in SeaSketch"}
              </a>
            </div>

            {featureItems && featureItems.length > 0 ? (
              <div className="mt-2">
                <div className="text-sm text-slate-200/90 mb-1 uppercase">
                  Features Used
                </div>
                <div className="md:flex md:space-x-8 space-y-2 md:space-y-0">
                  {featureItems.map((f) => (
                    <div key={f.title} className="md:flex-1">
                      <div className="flex items-center text-white">
                        {/* <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" /> */}
                        <span className="font-semibold text-sm sm:text-base">
                          {f.title}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-200/95 text-sm">
                        {f.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
