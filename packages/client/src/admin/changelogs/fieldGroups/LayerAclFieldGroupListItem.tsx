import { LockClosedIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";
import { accessTypeLabel } from "./labels";

const SIMPLE_GROUP_LIST_MAX_GROUPS = 3;
const SIMPLE_GROUP_LIST_MAX_CHARACTERS = 40;

function groupNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((group) => valueText(group).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function changedGroups(fromGroups: string[], toGroups: string[]) {
  return {
    added: toGroups.filter((group) => !fromGroups.includes(group)),
    removed: fromGroups.filter((group) => !toGroups.includes(group)),
  };
}

function canListGroupsInline(groups: string[]) {
  return (
    groups.length > 0 &&
    groups.length <= SIMPLE_GROUP_LIST_MAX_GROUPS &&
    groups.join(", ").length <= SIMPLE_GROUP_LIST_MAX_CHARACTERS
  );
}

function GroupListDetails({ groups }: { groups: string[] }) {
  return (
    <div className="max-w-xs p-2 text-left text-sm">
      <GroupList groups={groups} compact />
    </div>
  );
}

function AccessControlListDetails({
  before,
  after,
}: {
  before: string[];
  after: string[];
}) {
  const { t } = useTranslation("admin:data");
  return (
    <div className="w-80 max-w-full text-left text-sm">
      <div className="border-b border-gray-100 px-3 py-2">
        <h3 className="font-semibold text-gray-900">
          <Trans ns="admin:data">Access control list</Trans>
        </h3>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <GroupListSection title={t("Before")} groups={before} />
        <GroupListSection title={t("After")} groups={after} />
      </div>
    </div>
  );
}

function GroupListSection({
  title,
  groups,
}: {
  title: string;
  groups: string[];
}) {
  return (
    <div>
      <div className="mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h4>
      </div>
      <GroupList groups={groups} />
    </div>
  );
}

function GroupList({
  groups,
  compact,
}: {
  groups: string[];
  compact?: boolean;
}) {
  return groups.length ? (
    <ul className="flex flex-wrap gap-1">
      {groups.map((group) => (
        <li
          key={group}
          className={
            compact
              ? "max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800"
              : "max-w-full truncate rounded bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700"
          }
          title={group}
        >
          {group}
        </li>
      ))}
    </ul>
  ) : (
    <p className="italic text-gray-500">
      <Trans ns="admin:data">No groups listed</Trans>
    </p>
  );
}

export default function LayerAclFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const fromType = accessTypeLabel(t, from.type);
  const toType = accessTypeLabel(t, to.type);
  const fromGroups = groupNames(from.groups);
  const toGroups = groupNames(to.groups);
  const beforeDetails =
    from.type === "group" ? <GroupListDetails groups={fromGroups} /> : undefined;
  const afterDetails =
    to.type === "group" ? <GroupListDetails groups={toGroups} /> : undefined;
  const listDetails = (
    <AccessControlListDetails before={fromGroups} after={toGroups} />
  );
  const typeChanged = from.type !== to.type;
  const { added, removed } = changedGroups(fromGroups, toGroups);
  const simpleAddition =
    !typeChanged && from.type === "group" && removed.length === 0;
  const simpleRemoval =
    !typeChanged && from.type === "group" && added.length === 0;
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<LockClosedIcon className="h-5 w-5" />}
      iconClassName="bg-red-50 text-red-500"
    >
      {typeChanged ? (
        <Trans ns="admin:data">
          changed access control from{" "}
          <ChangeValue deleted details={beforeDetails}>
            {fromType}
          </ChangeValue>{" "}
          to <ChangeValue details={afterDetails}>{toType}</ChangeValue>
        </Trans>
      ) : simpleAddition && canListGroupsInline(added) ? (
        <>
          {t("Added")} <ChangeValue>{added.join(", ")}</ChangeValue>{" "}
          {t("to the access control list.")}
        </>
      ) : simpleRemoval && canListGroupsInline(removed) ? (
        <>
          {t("Removed")} <ChangeValue deleted>{removed.join(", ")}</ChangeValue>{" "}
          {t("from the access control list.")}
        </>
      ) : (
        <>
          {t("Updated the")}{" "}
          <ChangeValue details={listDetails}>{t("access control list")}</ChangeValue>
          .
        </>
      )}
    </BaseFieldGroupListItem>
  );
}
