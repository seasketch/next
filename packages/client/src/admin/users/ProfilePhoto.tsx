/* eslint-disable i18next/no-literal-string */
import { Maybe } from "graphql/jsutils/Maybe";
import React from "react";
import Gravatar from "react-gravatar";
import md5 from "md5";
import clsx from "clsx";

// const supportsSrcSet = "srcset" in document.createElement("img");

export default function ProfilePhoto({
  fullname,
  email,
  canonicalEmail,
  picture,
  defaultImg,
  border,
  square,
}: {
  fullname?: string | Maybe<string>;
  email?: string | Maybe<string>;
  canonicalEmail: string;
  picture?: string | Maybe<string>;
  defaultImg?: Gravatar.DefaultImage;
  border?: boolean;
  square?: boolean;
}) {
  const hash = picture
    ? ""
    : email || canonicalEmail
    ? md5(email || canonicalEmail)
    : "";
  let bg = picture
    ? `url("${picture}")`
    : `url("http://www.gravatar.com/avatar/${hash}?d=retro&r=g&s=200")`;
  return (
    <div
      role="img"
      aria-label={
        fullname || email || canonicalEmail ? "User photo" : undefined
      }
      className={clsx(
        `w-full h-full inline-block`,
        square ? "rounded-sm" : "rounded-full",
        border ? "border-2 shadow bg-white border-white" : ""
      )}
      style={{
        backgroundImage: bg,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    ></div>
  );
  // if (picture) {
  //   return (
  //     <img
  //       alt={alt}
  //       src={picture}
  //       className="h-full w-auto inline rounded-full"
  //     />
  //   );
  // } else {
  //   return (
  //     <Gravatar
  //       alt={alt}
  //       email={email || canonicalEmail}
  //       default={defaultImg || "404"}
  //       // @ts-ignore
  //       fallback={defaultImg ? undefined : <div></div>}
  //       className="h-full w-auto inline rounded-full flex-shrink-0"
  //     />
  //   );
  // }
}
