import { summary, Summary, valueText } from "./FieldGroupListItemBase";

export function tocItemIdFromMeta(meta: unknown): number | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const value = (meta as Record<string, unknown>).table_of_contents_item_id;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function tableNameFromSummary(s: Summary): string {
  return valueText(s.name);
}

export function tableIdFromSummary(s: Summary): number | undefined {
  const value = s.id;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function parquetUrlFromSummary(s: Summary): string | undefined {
  const url = s.parquet_url;
  if (typeof url === "string" && url.length > 0) {
    return url;
  }
  return undefined;
}

export function tableVersionFromSummary(s: Summary): number | undefined {
  const version = s.version;
  if (typeof version === "number" && Number.isFinite(version)) {
    return version;
  }
  if (typeof version === "string") {
    const parsed = parseInt(version, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function tableLabel(
  s: Summary,
  fallback: string,
  options?: { includeVersion?: boolean },
): string {
  const name = tableNameFromSummary(s) || fallback;
  const version = tableVersionFromSummary(s);
  if (options?.includeVersion === false || version == null) {
    return name;
  }
  // eslint-disable-next-line i18next/no-literal-string -- version suffix formatted for display inside Trans/ChangeValue
  return `${name} (v${version})`;
}

export function tableLabelFromChangeLog(
  fromSummary: unknown,
  toSummary: unknown,
  prefer: "from" | "to",
  fallback: string,
): string {
  const from = summary(fromSummary);
  const to = summary(toSummary);
  const s = prefer === "from" ? from : to;
  return tableLabel(s, fallback);
}

export function removedVersionFromSummary(s: Summary): number | undefined {
  const removed = s.removed_version;
  if (typeof removed === "number" && Number.isFinite(removed)) {
    return removed;
  }
  if (typeof removed === "string") {
    const parsed = parseInt(removed, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function dataTableEventDescription(
  fieldGroup: string,
  fromSummary: unknown,
  toSummary: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const from = summary(fromSummary);
  const to = summary(toSummary);
  const fallback = t("Untitled table");

  switch (fieldGroup) {
    case "DATA_TABLE_CREATED":
      return t("Uploaded {{table}}", {
        table: tableLabel(to, fallback),
      });
    case "DATA_TABLE_REPLACED": {
      const fromVersion = tableVersionFromSummary(from);
      const toVersion = tableVersionFromSummary(to);
      const name = tableNameFromSummary(to) || tableNameFromSummary(from) || fallback;
      if (fromVersion != null && toVersion != null) {
        return t("Replaced {{name}} v{{fromVersion}} → v{{toVersion}}", {
          name,
          fromVersion,
          toVersion,
        });
      }
      return t("Replaced {{table}}", { table: tableLabel(to, fallback) });
    }
    case "DATA_TABLE_RENAMED": {
      const version = tableVersionFromSummary(to);
      const fromName = tableNameFromSummary(from) || fallback;
      const toName = tableNameFromSummary(to) || fallback;
      if (version != null) {
        return t("Renamed {{fromName}} → {{toName}} (v{{version}})", {
          fromName,
          toName,
          version,
        });
      }
      return t("Renamed {{fromName}} → {{toName}}", { fromName, toName });
    }
    case "DATA_TABLE_DELETED":
      return t("Deleted {{table}}", {
        table: tableLabel(from, fallback),
      });
    case "DATA_TABLE_ROLLBACK": {
      const removedVersion = removedVersionFromSummary(from);
      const restored = tableLabel(to, fallback);
      if (removedVersion != null) {
        return t("Rolled back to {{restored}} (removed v{{removedVersion}})", {
          restored,
          removedVersion,
        });
      }
      return t("Rolled back to {{restored}}", { restored });
    }
    default:
      return t("Updated data table");
  }
}
