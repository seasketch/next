/* eslint-disable i18next/no-literal-string */
import React from "react";

/**
 * Shared layout and typography primitives for public legal / trust pages
 * (Terms of Use, Privacy Policy, Data Handling & Sub-processors).
 */

export function LegalPageLayout({
  eyebrow,
  title,
  lastUpdated,
  children,
}: {
  eyebrow?: string;
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-gray-900">
      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <header>
          {eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          {lastUpdated && (
            <p className="mt-3 text-sm text-gray-500">
              Last updated {lastUpdated}
            </p>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

export function SectionHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mt-14 text-2xl font-semibold tracking-tight text-gray-900"
    >
      {children}
    </h2>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-lg font-semibold text-gray-900">{children}</h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-base leading-7 text-gray-600">{children}</p>;
}

export function TextLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      className="font-medium text-primary-600 underline decoration-primary-300 underline-offset-2 hover:decoration-primary-600"
      href={href}
      rel={external ? "nofollow" : undefined}
    >
      {children}
    </a>
  );
}

/** Unordered list whose items lead with a bold label, styled with a left accent border. */
export function LeadList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 space-y-4 text-base leading-7 text-gray-600">
      {children}
    </ul>
  );
}

export function LeadItem({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="pl-4 border-l-2 border-gray-200">
      {label && (
        <>
          <span className="font-semibold text-gray-900">{label}</span>{" "}
        </>
      )}
      {children}
    </li>
  );
}

export function NumberedList({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mt-4 list-decimal space-y-3 pl-6 text-base leading-7 text-gray-600 marker:text-gray-400">
      {children}
    </ol>
  );
}

export function BulletList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-gray-600 marker:text-gray-400">
      {children}
    </ul>
  );
}
