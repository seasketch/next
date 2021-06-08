import React from "react";
import {
  BanIcon,
  DocumentTextIcon,
  InboxInIcon,
  KeyIcon,
  MailIcon,
  MailOpenIcon,
  PaperClipIcon,
  PencilIcon,
  XCircleIcon,
} from "@heroicons/react/outline";
import {
  EmailStatus,
  InviteEmail,
  InviteStatus,
} from "../../generated/graphql";
import Spinner from "../../components/Spinner";

export default function InviteIcon({
  status,
  size,
  wasUsed,
  tokenExpiresAt,
}: {
  status: InviteStatus | EmailStatus;
  tokenExpiresAt?: string;
  wasUsed?: boolean;
  size: number;
}) {
  // eslint-disable-next-line i18next/no-literal-string
  const className = `w-${size} h-${size} text-gray-800 p-1`;
  if (wasUsed) {
    return <MailOpenIcon className={className} />;
  }
  if (tokenExpired(tokenExpiresAt) && !wasUsed) {
    status = InviteStatus.TokenExpired;
  }
  switch (status) {
    case InviteStatus.Unsent:
      return <PaperClipIcon className={className} />;
    case InviteStatus.Queued:
    case EmailStatus.Queued:
      // return <Spinner className={className + " -ml-0 -mb-1"} />;
      return (
        <>
          <span className="relative animate-pulse">
            {/* <span className="w-0.5 h-0.5 bg-gray-500 z-0 rounded-full absolute top-3 left-0.5 animate-bounce">
              &nbsp;
            </span> */}
            <span className="w-1.5 h-0.5 bg-gray-500 z-0 rounded-full absolute top-3 -left-0.5 ">
              &nbsp;
            </span>

            <span className="w-1 h-0.5 bg-gray-500 z-0 rounded-full absolute top-4 -left-0  ">
              &nbsp;
            </span>
            <span className="w-1.5 h-0.5 bg-gray-500 z-0 rounded-full absolute top-5 -left-0.5 ">
              &nbsp;
            </span>
            <MailIcon className={`${className}`} />
            {/* <svg
              xmlns="http://www.w3.org/2000/svg"
              // enable-background="new 0 0 24 24"
              height="18px"
              viewBox="0 0 24 24"
              width="18px"
              // fill="#000000"
              className="absolute top-3 -left-1"
            >
              <g>
                <rect fill="none" height="24" width="24" />
              </g>
              <g>
                <path d="M6,2l0.01,6L10,12l-3.99,4.01L6,22h12v-6l-4-4l4-3.99V2H6z M16,16.5V20H8v-3.5l4-4L16,16.5z" />
              </g>
            </svg> */}
          </span>
        </>
      );
    case InviteStatus.Sent:
    case EmailStatus.Sent:
      return <MailIcon className={className} />;
    case InviteStatus.Delivered:
    case EmailStatus.Delivered:
      return <InboxInIcon className={className} />;
    case InviteStatus.Confirmed:
      return <MailOpenIcon className={className} />;
    case InviteStatus.Complaint:
    case EmailStatus.Complaint:
      return <BanIcon className={className + " text-red-600"} />;
    case InviteStatus.Error:
    case EmailStatus.Error:
    case InviteStatus.Bounced:
    case EmailStatus.Bounced:
      return <XCircleIcon className={className + " text-red-600"} />;
    case InviteStatus.TokenExpired:
      return <KeyIcon className={className + " text-yellow-700"} />;
    default:
      return <MailIcon className={className} />;
  }
}

function tokenExpired(expiresAt?: string) {
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return true;
  } else {
    return false;
  }
}
