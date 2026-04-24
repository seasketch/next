import { TFunction } from "react-i18next";
import { valueText } from "./FieldGroupListItemBase";

export function accessTypeLabel(t: TFunction<"admin:data">, value: unknown) {
  switch (value) {
    case "public":
      return t("public");
    case "admins_only":
      return t("admins only");
    case "group":
      return t("groups");
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
