/* eslint-disable i18next/no-literal-string */
import { Link1Icon } from "@radix-ui/react-icons";
import React from "react";
import { Link } from "react-router-dom";

export interface TestimonialProps {
  quote: string;
  author: string;
  affiliation?: string;
  headshotSrc?: string;
  compact?: boolean;
  link?: {
    label: string;
    to: string;
  };
}

export default function Testimonial(props: TestimonialProps) {
  const { quote, author, affiliation, headshotSrc, compact, link } = props;
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
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 ${
            compact ? "mt-4" : "mt-6"
          }`}
        >
          <div className="flex min-w-0 items-center gap-4">
            {headshotSrc ? (
              <img
                src={headshotSrc}
                alt={author}
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : null}
            <div className="min-w-0">
              <div className="font-medium text-slate-900">{author}</div>
              {affiliation ? (
                <div className="text-sm text-slate-600">{affiliation}</div>
              ) : null}
            </div>
          </div>
          {link ? (
            <Link
              to={link.to}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm ring-1 ring-slate-200/60 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 hover:ring-sky-200/80"
            >
              <Link1Icon className="h-3.5 w-3.5" aria-hidden />
              {link.label}
            </Link>
          ) : null}
        </figcaption>
      </figure>
    </section>
  );
}
