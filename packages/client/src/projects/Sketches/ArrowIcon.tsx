import { ChevronRightIcon } from "@heroicons/react/outline";

export default function ArrowIcon({
  isOpen,
  className: classNameProp,
}: {
  isOpen: boolean;
  className?: string;
}) {
  // eslint-disable-next-line i18next/no-literal-string
  const className = `w-4 h-4 text-gray-700 duration-100 transition transform ${classNameProp} ${
    isOpen ? "rotate-90" : "rotate-0"
  }`;
  return <ChevronRightIcon className={className} />;
}
