import {
  ArrowDownIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/outline";

export default function ArrowIcon({
  isOpen,
  className,
}: {
  isOpen: boolean;
  className?: string;
}) {
  // eslint-disable-next-line i18next/no-literal-string
  const style = `w-4 h-4 text-gray-700 ${className} `;
  if (isOpen) {
    return <ChevronDownIcon className={style} />;
  } else {
    return <ChevronRightIcon className={style} />;
  }
}
