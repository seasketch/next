import React, { ReactNode } from "react";

export interface SectionProps {
  id?: string;
  title: string;
  children: ReactNode;
}

export default function Section(props: SectionProps) {
  const { id, title, children } = props;
  return (
    <section id={id} className="mx-auto max-w-5xl px-6 py-6 pb-4">
      <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-4">
        {title}
      </h2>
      <div className="prose prose-slate max-w-none">{children}</div>
    </section>
  );
}
