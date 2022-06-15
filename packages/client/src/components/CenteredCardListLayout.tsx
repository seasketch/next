import { ReactNode } from "react";

export default function CenteredCardListLayout({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`space-y-5 sm:p-4 w-full ${className}`}>{children}</div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`bg-white border-b sm:border-b-0 sm:shadow sm:rounded sm:mx-auto p-4 max-w-full sm:max-w-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export function Header({
  children,
  level,
}: {
  children: ReactNode;
  level?: number;
}) {
  return (
    <h1
      className={`max-w-full sm:max-w-2xl sm:mx-auto ${
        level === 2 ? "text-base" : "text-lg"
      }`}
    >
      {children}
    </h1>
  );
}
