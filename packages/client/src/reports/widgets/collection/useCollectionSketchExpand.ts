import { useMemo, useState } from "react";
import { SketchGeometryType } from "../../../generated/graphql";
import { useSubjectReportContext } from "../../context/SubjectReportContext";

type SketchClassLike = {
  geometryType: SketchGeometryType;
};

/**
 * Collection reports: expandable rows keyed by {@link rowKey} (class row key or geography id string).
 */
export function useCollectionSketchExpand(sketchClass: SketchClassLike) {
  const isCollection =
    sketchClass.geometryType === SketchGeometryType.Collection;

  const subjectReportContext = useSubjectReportContext();

  const sketchNameById = useMemo(() => {
    const map = new Map<number, string>();
    const children = subjectReportContext.data?.childSketches;
    if (children) {
      for (const s of children) {
        map.set(s.id, s.name);
      }
    }
    return map;
  }, [subjectReportContext.data?.childSketches]);

  const childSketchIds = useMemo(
    () =>
      subjectReportContext.data?.childSketches?.map((c) => c.id) ?? [],
    [subjectReportContext.data?.childSketches],
  );

  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleRow = (key: string) => {
    setExpandedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /** After any row is expanded, skip caret tooltips — user has learned the control. */
  const hideCaretExpandTooltip = expandedRowKeys.size > 0;

  return {
    isCollection,
    sketchNameById,
    childSketchIds,
    expandedRowKeys,
    toggleRow,
    hideCaretExpandTooltip,
  };
}
