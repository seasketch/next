import React from "react";
import logo from "../header/seasketch-logo.png";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  LayersButton,
  MapButton,
  SketchingButton,
  ForumsButton,
  AdminButton,
} from "./MiniSidebarButtons";
import { useHistory, useParams } from "react-router-dom";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";
import { MenuToggle } from "./MenuToggle";
import { ProfileStatusButton } from "../header/ProfileStatusButton";

export default function MiniSidebar({
  onExpand,
  dark,
}: {
  onExpand: () => void;
  dark: boolean;
}) {
  const { slug, sidebar } = useParams<{ slug: string; sidebar: string }>();
  const history = useHistory();
  const { data } = useCurrentProjectMetadataQuery();

  const { t } = useTranslation("sidebar");

  const openSidebar = (s: string) => () => {
    if (sidebar === s) {
      history.replace(`/${slug}/app`);
    } else {
      history.replace(`/${slug}/app/${s}`);
    }
  };

  return (
    <motion.div
      style={{ boxShadow: "0px -2px 5px rgba(0,0,0,0.5)" }}
      className={`absolute left-0 w-16 h-full ${
        dark ? "bg-cool-gray-800 text-gray-400" : "bg-white text-gray-700"
      }  z-20 p-0 flex flex-col items-center`}
    >
      <MenuToggle
        className={`mt-4 ${dark ? "text-gray-400" : "text-gray-700"}`}
        onClick={onExpand}
      />
      <MapButton
        tooltip={t("Maps")}
        tabIndex={2}
        className="mt-4"
        onClick={openSidebar("maps")}
        sidebarOpen={sidebar === "maps"}
        anySidebarOpen={!!sidebar}
      />
      <LayersButton
        sidebarOpen={sidebar === "overlays"}
        onClick={openSidebar("overlays")}
        tooltip={t("Overlay Layers")}
        tabIndex={3}
        anySidebarOpen={!!sidebar}
      />
      <SketchingButton
        tooltip={t("Sketches")}
        sidebarOpen={sidebar === "sketches"}
        onClick={openSidebar("sketches")}
        tabIndex={4}
        anySidebarOpen={!!sidebar}
      />
      <ForumsButton
        tooltip={t("Discussion Forums")}
        sidebarOpen={sidebar === "forums"}
        onClick={openSidebar("forums")}
        tabIndex={5}
        anySidebarOpen={!!sidebar}
      />

      {data?.currentProject?.sessionIsAdmin && (
        <AdminButton
          href={`/${slug}/admin`}
          tooltip={t("Administration")}
          tabIndex={6}
          anySidebarOpen={!!sidebar}
        />
      )}
      <div className="w-8 mt-3" style={{ filter: "grayscale(50%)" }}>
        <ProfileStatusButton onClick={onExpand} />
      </div>
      <a className={`w-8 bottom-6 -ml-0.5 absolute`} href="/">
        <motion.img src={logo} />
      </a>
    </motion.div>
  );
}
