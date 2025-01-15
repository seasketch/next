import logo from "../header/seasketch-logo.png";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  LayersButton,
  MapButton,
  SketchingButton,
  ForumsButton,
  AdminButton,
  LanguageButton,
  AboutButton,
} from "./MiniSidebarButtons";
import { useHistory, useParams } from "react-router-dom";
import { MenuToggle } from "./MenuToggle";
import { ProfileStatusButton } from "../header/ProfileStatusButton";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import { getLastFormUrl } from "./Forums/Forums";
import LanguageSelector from "../surveys/LanguageSelector";

export default function MiniSidebar({
  onExpand,
  dark,
}: {
  onExpand: () => void;
  dark: boolean;
}) {
  const { slug, sidebar } = useParams<{ slug: string; sidebar: string }>();
  const history = useHistory();
  const { data } = useCurrentProjectMetadata();

  const { t } = useTranslation("sidebar");

  const openSidebar = (s: string) => () => {
    if (sidebar === s) {
      if (s === "forums") {
        if (history.location.pathname !== `/${slug}/app/forums`) {
          history.replace(`/${slug}/app/forums`);
        } else {
          history.replace(`/${slug}/app`);
        }
      } else {
        history.replace(`/${slug}/app`);
      }
    } else {
      if (s === "forums") {
        const lastUrl = getLastFormUrl();
        if (lastUrl) {
          history.replace(lastUrl);
        } else {
          history.replace(`/${slug}/app/${s}`);
        }
      } else {
        history.replace(`/${slug}/app/${s}`);
      }
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
      {data?.project?.aboutPageEnabled && (
        <AboutButton
          tooltip={t("About")}
          tabIndex={1}
          className="mt-4"
          sidebarOpen={sidebar === "about"}
          onClick={openSidebar("about")}
          anySidebarOpen={!!sidebar}
        />
      )}
      <MapButton
        tooltip={t("Maps")}
        tabIndex={2}
        className={!data?.project?.aboutPageEnabled ? "mt-4" : ""}
        onClick={openSidebar("maps")}
        sidebarOpen={sidebar === "maps"}
        anySidebarOpen={!!sidebar}
      />
      {data?.project?.hideOverlays !== true && (
        <LayersButton
          sidebarOpen={sidebar === "overlays"}
          onClick={openSidebar("overlays")}
          tooltip={t("Overlay Layers")}
          tabIndex={3}
          anySidebarOpen={!!sidebar}
        />
      )}
      {data?.project?.hideSketches !== true && (
        <SketchingButton
          tooltip={t("Sketches")}
          sidebarOpen={sidebar === "sketches"}
          onClick={openSidebar("sketches")}
          tabIndex={4}
          anySidebarOpen={!!sidebar}
        />
      )}
      {data?.project?.hideForums !== true && (
        <ForumsButton
          tooltip={t("Discussion Forums")}
          sidebarOpen={sidebar === "forums"}
          onClick={openSidebar("forums")}
          tabIndex={5}
          anySidebarOpen={!!sidebar}
        />
      )}
      {/* <SettingsButton
        tooltip={t("Account Settings")}
        sidebarOpen={sidebar === "settings"}
        onClick={openSidebar("settings")}
        tabIndex={6}
        anySidebarOpen={!!sidebar}
      /> */}

      {data?.me && (
        <div className="w-8 my-3" style={{ filter: "grayscale(50%)" }}>
          <ProfileStatusButton onClick={onExpand} />
        </div>
      )}
      <LanguageSelector
        button={(onClick, lang) => (
          <LanguageButton
            tooltip={t("Language")}
            tabIndex={6}
            onClick={onClick}
          />
        )}
        options={data?.project?.supportedLanguages as string[]}
      />

      {data?.project?.sessionIsAdmin && (
        <AdminButton
          href={`/${slug}/admin`}
          tooltip={t("Administration")}
          tabIndex={7}
          anySidebarOpen={!!sidebar}
        />
      )}
      <a className={`w-8 bottom-6 -ml-0.5 absolute`} href="/">
        <motion.img src={logo} />
      </a>
    </motion.div>
  );
}
