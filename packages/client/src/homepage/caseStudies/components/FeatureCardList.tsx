import React from "react";

export interface FeatureCardItem {
  title: string;
  description: string;
}

export interface FeatureCardListProps {
  title?: string;
  items: FeatureCardItem[];
  className?: string;
}

export default function FeatureCardList(props: FeatureCardListProps) {
  const { title, items, className } = props;
  if (!items || items.length === 0) return null;
  return (
    <div
      className={
        "rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-5 py-5 shadow-sm " +
        (className || "")
      }
    >
      {title ? (
        <h3 className="text-base font-bold text-slate-900 mb-3">{title}</h3>
      ) : null}
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.title}>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
              {it.title}
            </div>
            <div className="mt-1 text-sm leading-5 text-slate-700">
              {it.description}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
