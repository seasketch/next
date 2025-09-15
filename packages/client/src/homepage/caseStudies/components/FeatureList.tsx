import React from "react";

export interface FeatureListProps {
  title?: string;
  features: string[];
}

export default function FeatureList(props: FeatureListProps) {
  const { title, features } = props;
  if (!features || features.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      {title ? (
        <h2 className="text-xl font-bold text-slate-100 mb-3">{title}</h2>
      ) : null}
      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {features.map((f) => (
          <li
            key={f}
            className="rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-200 shadow-sm"
          >
            <span className="font-semibold">{f}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
