import React from "react";
import { GroupList } from "./ParticipantRow";
import InviteIcon from "./InviteIcon";
import Fuse from "fuse.js";
import { InviteDetailsFragment, InviteStatus } from "../../generated/graphql";
import strind from "strind";

function InviteRow({
  index,
  fullname,
  email,
  groups,
  makeAdmin,
  style,
  checked,
  onClick,
  tokenExpiresAt,
  status,
  wasUsed,
  matches,
  id,
}: {
  id: number;
  fullname?: string;
  email?: string;
  groups: { name: string }[];
  makeAdmin: boolean;
  style?: React.CSSProperties;
  index: number;
  checked?: boolean;
  status: InviteStatus;
  onClick?: (id: number) => void;
  tokenExpiresAt?: string;
  wasUsed?: boolean;
  matches?: Fuse.FuseResult<InviteDetailsFragment>;
}) {
  return (
    <button
      className={`${
        index % 2 ? "bg-cool-gray-50" : "bg-white"
      } flex flex-row px-2 items-center border-b border-opacity-10 text-left`}
      style={{ ...style }}
      onClick={onClick ? () => onClick(id) : undefined}
    >
      {checked === true || checked === false ? (
        <input
          className="rounded text-primary-600"
          type="checkbox"
          checked={checked}
        />
      ) : null}
      <InviteIcon
        wasUsed={wasUsed}
        tokenExpiresAt={tokenExpiresAt}
        status={status}
        size={8}
      />
      <span
        className="truncate xl:text-base flex-grow"
        style={{ lineHeight: "1.5rem" }}
      >
        <span>
          <HighlightedText
            text={fullname}
            match={matches?.matches?.find((m) => m.key === "fullname")}
          />
        </span>
        {/* {fullname && (
          <span className="">
            {fullname}{" "}
            <span className="font-mono text-gray-600">
              {"<"}
              {email}
              {">"}
            </span>
          </span>
        )} */}
        &nbsp;
        <span className={`${fullname && "text-gray-500"}`}>
          {fullname && "<"}
          <HighlightedText
            text={email}
            match={matches?.matches?.find((m) => m.key === "email")}
          />
          {fullname && ">"}
        </span>
      </span>
      <GroupList isAdmin={makeAdmin} groups={groups.map((g) => g.name)} />
    </button>
  );
}

function HighlightedText({
  match,
  text,
}: {
  match?: Fuse.FuseResultMatch;
  text?: string;
}) {
  if (!text) {
    return <span></span>;
  } else if (match) {
    const parts = strind(text, [...match.indices], ({ chars, matches }) => {
      return {
        text: chars,
        isHighlighted: matches,
      };
    });
    return (
      <>
        {(parts.matched as { text: string; isHighlighted: boolean }[]).map(
          ({ text, isHighlighted }) => {
            return (
              <span
                className={`${isHighlighted ? "bg-yellow-100" : "bg-white"}`}
              >
                {text}
              </span>
            );
          }
        )}
      </>
    );
  } else {
    return <span>{text}</span>;
  }
}

// InviteRow.whyDidYouRender = true;

export default React.memo(InviteRow);
