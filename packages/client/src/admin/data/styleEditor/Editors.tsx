import { InfoCircledIcon } from "@radix-ui/react-icons";
import * as Slider from "@radix-ui/react-slider";
import { ReactNode } from "react";

export function DocumentationInfo({ href }: { href: string }) {
  return (
    <a
      className="text-gray-500 hover:text-gray-300"
      href={href}
      target="_blank"
    >
      <InfoCircledIcon />
    </a>
  );
}

export function Root({
  children,
  block,
  className,
}: {
  children?: ReactNode;
  block?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${block ? "space-y-1" : "flex h-10"} items-center relative ${
        className ? className : ""
      }`}
    >
      {children}
    </div>
  );
}

export function Label({
  title,
  docs,
}: {
  title: string | ReactNode;
  docs?: string;
}) {
  return (
    <h3 className="flex-1 flex items-center space-x-1">
      <span>{title}</span>
      {docs && <DocumentationInfo href={docs} />}
    </h3>
  );
}

export function Control({ children }: { children?: ReactNode }) {
  return <div className="flex items-center text-sm">{children}</div>;
}

export function Header({ title }: { title: string | ReactNode }) {
  return <h4 className="text-sm font-semibold py-3">{title}</h4>;
}

export function Thumb({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Slider.Thumb
      className={`block w-3 h-5 bg-gray-300  shadow rounded hover:bg-gray-100 focus:outline-none focus:shadow ${className}`}
      style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.5)" }}
      aria-label={ariaLabel}
    />
  );
}
