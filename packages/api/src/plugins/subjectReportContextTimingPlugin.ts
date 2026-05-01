import { makeWrapResolversPlugin } from "postgraphile";
import {
  isReportDepsProfileEnabled,
  reportDepsProfileLog,
  reportDepsProfileNowNs,
} from "../reportDepsProfiling";

const SCOPE = "SubjectReportContext";

function wrapPhase(
  phase: string,
  getCtx?: (
    source: any,
    args: any,
  ) => Record<string, string | number | boolean | undefined>,
) {
  return (resolve: any, source: any, args: any, context: any, info: any) => {
    if (!isReportDepsProfileEnabled()) {
      return resolve(source, args, context, info);
    }
    const ns = reportDepsProfileNowNs();
    return Promise.resolve(resolve(source, args, context, info)).then(
      (result: unknown) => {
        const extra = getCtx?.(source, args) ?? {};
        reportDepsProfileLog(SCOPE, phase, ns, extra);
        return result;
      },
    );
  };
}

/**
 * When `REPORT_DEPS_PROFILE=1`, logs per-field resolver time for the
 * SubjectReportContext query (sketch + report UI seed data).
 */
export default makeWrapResolversPlugin({
  Query: {
    sketch: wrapPhase("Query.sketch", (_s, args: any) => ({
      sketchId: args?.id ?? "unknown",
    })),
  },
  Sketch: {
    relatedFragments: wrapPhase("Sketch.relatedFragments", (s: any) => ({
      sketchId: s?.id,
    })),
    siblings: wrapPhase("Sketch.siblings", (s: any) => ({
      sketchId: s?.id,
    })),
    children: wrapPhase("Sketch.children", (s: any) => ({
      sketchId: s?.id,
    })),
    sketchClass: wrapPhase("Sketch.sketchClass", (s: any) => ({
      sketchId: s?.id,
    })),
    userAttributes: wrapPhase("Sketch.userAttributes", (s: any) => ({
      sketchId: s?.id,
    })),
  },
  SketchClass: {
    form: wrapPhase("SketchClass.form", (sc: any) => ({
      sketchClassId: sc?.id,
    })),
    validChildren: wrapPhase("SketchClass.validChildren", (sc: any) => ({
      sketchClassId: sc?.id,
    })),
    project: wrapPhase("SketchClass.project", (sc: any) => ({
      sketchClassId: sc?.id,
    })),
    clippingGeographies: wrapPhase(
      "SketchClass.clippingGeographies",
      (sc: any) => ({
        sketchClassId: sc?.id,
      }),
    ),
  },
  Form: {
    formElements: wrapPhase("Form.formElements", (f: any) => ({
      formId: f?.id,
    })),
    logicRules: wrapPhase("Form.logicRules", (f: any) => ({
      formId: f?.id,
    })),
  },
  Project: {
    geographies: wrapPhase("Project.geographies", (p: any) => ({
      projectId: p?.id,
    })),
    sketchClasses: wrapPhase("Project.sketchClasses", (p: any) => ({
      projectId: p?.id,
    })),
    sessionIsAdmin: wrapPhase("Project.sessionIsAdmin", (p: any) => ({
      projectId: p?.id,
    })),
    supportedLanguages: wrapPhase(
      "Project.supportedLanguages",
      (p: any) => ({
        projectId: p?.id,
      }),
    ),
  },
});
