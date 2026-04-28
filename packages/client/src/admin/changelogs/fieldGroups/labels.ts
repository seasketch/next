import { TFunction } from "react-i18next";
import { InteractivityType } from "../../../generated/graphql";
import { valueText } from "./FieldGroupListItemBase";

export function accessTypeLabel(t: TFunction<"admin:data">, value: unknown) {
  switch (value) {
    case "public":
      return t("public");
    case "admins_only":
      return t("admins only");
    case "group":
      return t("group access");
    default:
      return valueText(value, t("custom access"));
  }
}

export function folderTypeLabel(t: TFunction<"admin:data">, value: unknown) {
  switch (value) {
    case "DEFAULT":
      return t("default");
    case "HIDDEN_CHILDREN":
      return t("hidden children");
    case "CHECK_OFF_ONLY":
      return t("check-off only");
    case "RADIO_CHILDREN":
      return t("radio children");
    default:
      return valueText(value, t("custom folder behavior"));
  }
}

export function downloadLabel(t: TFunction<"admin:data">, value: unknown) {
  return value === true ? t("enabled") : t("disabled");
}

/** Labels aligned with {@link InteractivitySettings} radio option titles. */
export function interactivityTypeLabel(
  t: TFunction<"admin:data">,
  value: unknown
): string {
  switch (value) {
    case InteractivityType.None:
      return t("None");
    case InteractivityType.Banner:
      return t("Banner");
    case InteractivityType.Tooltip:
      return t("Tooltip");
    case InteractivityType.Popup:
      return t("Custom popup");
    case InteractivityType.AllPropertiesPopup:
      return t("Popup with all columns");
    case InteractivityType.SidebarOverlay:
      return t("Sidebar");
    case InteractivityType.FixedBlock:
      return t("Fixed block");
    default:
      return valueText(value, t("custom interactivity"));
  }
}
