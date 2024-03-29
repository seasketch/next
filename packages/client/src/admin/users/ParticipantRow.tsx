import React from "react";
import Badge from "../../components/Badge";
import { Trans } from "react-i18next";
import {
  BanIcon,
  ExclamationIcon,
  ShieldCheckIcon,
  StopIcon,
  UserAddIcon,
} from "@heroicons/react/outline";
import ProfilePhoto from "./ProfilePhoto";

export default function ParticipantRow({
  index,
  fullname,
  email,
  canonicalEmail,
  groups,
  isAdmin,
  style,
  picture,
  checked,
  onClick,
  isBanned,
  needsApproval,
  denied,
  approved,
}: {
  picture?: string;
  fullname?: string;
  email?: string;
  canonicalEmail: string;
  groups: string[];
  isAdmin: boolean;
  style?: React.CSSProperties;
  index: number;
  checked?: boolean;
  onClick?: () => void;
  isBanned?: boolean;
  needsApproval?: boolean;
  denied?: boolean;
  approved?: boolean;
}) {
  return (
    <button
      className={`${
        index % 2 ? "bg-cool-gray-50" : "bg-white"
      } flex flex-row px-2 items-center border-b border-opacity-10 text-left`}
      style={{ ...style }}
      onClick={onClick}
    >
      {checked === true || checked === false ? (
        <input
          className="rounded text-primary-600"
          type="checkbox"
          checked={checked}
        />
      ) : null}
      <div className="w-8 h-full py-1 mr-2">
        <ProfilePhoto
          fullname={fullname}
          email={email}
          canonicalEmail={canonicalEmail}
          picture={picture}
        />
      </div>
      <span
        className="truncate text-sm xl:text-base flex-grow"
        style={{ lineHeight: "1.5rem" }}
      >
        {fullname || email || canonicalEmail}
      </span>
      <GroupList
        needsApproval={needsApproval}
        isAdmin={isAdmin}
        groups={groups}
        isBanned={isBanned}
        denied={denied}
        approved={approved}
      />
    </button>
  );
}

export function GroupList({
  groups,
  isAdmin,
  isBanned,
  needsApproval,
  denied,
  approved,
}: {
  groups: string[];
  isAdmin?: boolean;
  isBanned?: boolean;
  needsApproval?: boolean;
  denied?: boolean;
  approved?: boolean;
}) {
  groups.sort((a, b) => a.length - b.length);
  return (
    <>
      {needsApproval && !denied && (
        <Badge variant="secondary" className="ml-1 whitespace-nowrap mr-1">
          <UserAddIcon className="w-4 h-4 -ml-1 mr-0.5 inline-block text-secondary-500 opacity-80" />
          <Trans ns="admin">Needs approval</Trans>
        </Badge>
      )}
      {denied && (
        <Badge variant="warning" className="ml-1 whitespace-nowrap mr-1">
          <ExclamationIcon className="w-4 h-4 -ml-1 mr-0.5 inline-block text-yellow-800 opacity-80" />
          <Trans ns="admin">Denied access</Trans>
        </Badge>
      )}
      {isAdmin && (
        <Badge variant="secondary" className="ml-1 whitespace-nowrap mr-1">
          <ShieldCheckIcon className="w-4 h-4 -ml-1 mr-0.5 inline-block text-secondary-500 opacity-80" />
          <Trans ns="admin">Admin</Trans>
        </Badge>
      )}
      {isBanned && (
        <Badge variant="error" className="ml-1 whitespace-nowrap mr-1">
          <BanIcon className="w-4 h-4 -ml-1 mr-0.5 inline-block text-red-800 opacity-80" />
          <Trans ns="admin">Ban</Trans>
        </Badge>
      )}
      {groups.map((g, i) => (
        <Badge
          key={g}
          className={`inline-block flex-initial truncate mr-1 z-10 border border-blue-800 border-opacity-40 xl:border-none  ${
            i > 0 ? "hidden xl:inline-block" : ""
          }`}
        >
          {g}
        </Badge>
      ))}
      {groups.length > 1 && (
        <span
          className="text-sm xl:hidden font-extralight bg-blue-100 text-blue-800 rounded-full relative right-5 pr-2 z-0 -mr-5"
          style={{ paddingLeft: "1.1rem" }}
        >
          +{groups.length - 1}
        </span>
      )}
    </>
  );
}
