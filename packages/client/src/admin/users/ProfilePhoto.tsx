import { Maybe } from "graphql/jsutils/Maybe";
import React from "react";
import Gravatar from "react-gravatar";

export default function ProfilePhoto({
  fullname,
  email,
  canonicalEmail,
  picture,
  defaultImg,
}: {
  fullname?: string | Maybe<string>;
  email?: string | Maybe<string>;
  canonicalEmail: string;
  picture?: string | Maybe<string>;
  defaultImg?: Gravatar.DefaultImage;
}) {
  const alt = fullname || email || canonicalEmail;
  if (picture) {
    return (
      <img
        alt={alt}
        src={picture}
        className="h-full p-1 w-auto inline rounded-full"
      />
    );
  } else {
    return (
      <Gravatar
        alt={alt}
        email={email || canonicalEmail}
        default={defaultImg || "404"}
        // @ts-ignore
        fallback={defaultImg ? undefined : <div></div>}
        className="h-full p-1 w-auto inline rounded-full flex-shrink-0"
      />
    );
  }
}
