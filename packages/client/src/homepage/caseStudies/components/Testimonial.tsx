/* eslint-disable i18next/no-literal-string */
import React from "react";

export interface TestimonialProps {
  quote: string;
  author: string;
  affiliation?: string;
  headshotSrc?: string;
  compact?: boolean;
}

export default function Testimonial(props: TestimonialProps) {
  const { quote, author, affiliation, headshotSrc, compact } = props;
  return (
    <section
      className={`mx-auto max-w-4xl ${compact ? "px-0 py-0" : "px-6 py-4"}`}
    >
      <figure
        className={`rounded-md bg-white/90 ring-1 ring-slate-200 shadow-md ${
          compact ? "p-5 sm:p-6" : "p-6 sm:p-8"
        }`}
      >
        <blockquote className="text-slate-800">
          <svg
            aria-hidden
            className={`text-sky-600 ${compact ? "h-5 w-5" : "h-6 w-6"}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V22h8.28v-8.28H7.17V11.3c0-1.13.92-2.05 2.05-2.05h1.06V6H7.17Zm9.66 0A5.17 5.17 0 0 0 11.66 11.17V22h8.28v-8.28h-3.11V11.3c0-1.13.92-2.05 2.05-2.05h1.06V6h-3.11Z" />
          </svg>
          <p
            className={`text-slate-800 ${
              compact ? "mt-2 text-sm leading-6" : "mt-3 text-base leading-7"
            }`}
          >
            {quote}
          </p>
        </blockquote>
        <figcaption
          className={`flex items-center gap-4 ${compact ? "mt-4" : "mt-6"}`}
        >
          {headshotSrc ? (
            <img
              src={headshotSrc}
              alt={author}
              className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : null}
          <div>
            <div className="font-medium text-slate-900">{author}</div>
            {affiliation ? (
              <div className="text-sm text-slate-600">{affiliation}</div>
            ) : null}
          </div>
        </figcaption>
      </figure>
    </section>
  );
}
