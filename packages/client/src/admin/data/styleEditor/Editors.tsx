import { InfoCircledIcon } from "@radix-ui/react-icons";
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

export function Root({ children }: { children?: ReactNode }) {
  return <div className="flex items-center h-10">{children}</div>;
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
