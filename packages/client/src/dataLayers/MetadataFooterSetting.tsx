import React from "react";

export default function MetadataFooterSetting({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900">{title}</div>
        <p className="mt-0.5 text-xs leading-snug text-gray-500">
          {description}
        </p>
      </div>
      <div className="flex-none">{children}</div>
    </div>
  );
}
