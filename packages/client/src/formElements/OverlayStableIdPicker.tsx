import { useTranslation } from "react-i18next";
import { useDraftTableOfContentsItemsForPickerQuery } from "../generated/graphql";
import getSlug from "../getSlug";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { SingleSelect } from "../admin/users/GroupMultiSelect";
import { useMemo } from "react";
import Spinner from "../components/Spinner";

interface Group {
  value: number;
  label: string;
  disabled?: boolean;
}

export default function OverlayStableIdSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value?: { stableId: string; title: string }) => void;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { data, loading } = useDraftTableOfContentsItemsForPickerQuery({
    variables: {
      slug: getSlug(),
    },
    onError,
  });

  const selectedValue = useMemo(() => {
    if (!value || !data?.projectBySlug?.draftTableOfContentsItems) {
      return undefined;
    }
    const item = data.projectBySlug.draftTableOfContentsItems.find(
      (i) => i.stableId === value
    );
    return item
      ? {
          value: item.id,
          label: `${item.title}${!item.hasMetadata ? " (no metadata)" : ""}`,
        }
      : undefined;
  }, [value, data?.projectBySlug?.draftTableOfContentsItems]);

  const choices = useMemo(() => {
    if (!data?.projectBySlug?.draftTableOfContentsItems) {
      return [];
    }
    return data.projectBySlug.draftTableOfContentsItems
      .filter((item) => !item.isFolder)
      .map((item) => ({
        value: item.id,
        label: `${item.title}${!item.hasMetadata ? " (no metadata)" : ""}`,
        disabled: false,
      }));
  }, [data?.projectBySlug?.draftTableOfContentsItems]);

  const handleChange = (newValue?: Group) => {
    if (!newValue) {
      onChange(undefined);
      return;
    }

    const item = data?.projectBySlug?.draftTableOfContentsItems?.find(
      (i) => i.id === newValue.value
    );
    if (item) {
      onChange({
        stableId: item.stableId,
        title: item.title,
      });
    }
  };

  if (loading && !data) {
    return <Spinner />;
  }

  return (
    <div className="space-y-2 w-64">
      <SingleSelect
        key={value || "empty"}
        groups={choices}
        value={selectedValue}
        onChange={handleChange}
        title=""
        loading={loading && !data}
      />
      {/* <p className="text-xs text-gray-500">
        {t(
          "Select an overlay to display its metadata when this filter is active. Layers without metadata are still selectable but will not display any information."
        )}
      </p> */}
    </div>
  );
}
