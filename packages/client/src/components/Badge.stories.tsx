import React from "react";
import { Story, Meta } from "@storybook/react/types-6-0";
import Badge, { BadgeProps } from "./Badge";

export default {
  title: "Badge",
  component: Badge,
} as Meta;

const variants = ["default", "primary", "secondary", "warning", "error"];

export const Badges = () => (
  <div className="w-80">
    {variants.map((variant) => {
      return (
        <div>
          {/* @ts-ignore */}
          <Badge variant={variant === "default" ? undefined : variant}>
            {variant}
          </Badge>
        </div>
      );
    })}
  </div>
);
