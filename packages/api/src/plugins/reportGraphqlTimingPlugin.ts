import { makeWrapResolversPlugin } from "postgraphile";
import {
  isReportDepsProfileEnabled,
  reportDepsProfileLog,
  reportDepsProfileNowNs,
} from "../reportDepsProfiling";

/**
 * Times PostGraphile resolution of Query.report (parent row load before Report.dependencies).
 */
const ReportGraphqlTimingPlugin = makeWrapResolversPlugin({
  Query: {
    report(resolve: any, source: any, args: { id?: number }, context: any, resolveInfo: any) {
      if (!isReportDepsProfileEnabled()) {
        return resolve(source, args, context, resolveInfo);
      }
      const ns = reportDepsProfileNowNs();
      return Promise.resolve(resolve(source, args, context, resolveInfo)).then(
        (result: unknown) => {
          reportDepsProfileLog(
            "Query.report",
            "fetchReportById",
            ns,
            {
              reportId: args.id ?? "unknown",
            },
          );
          return result;
        },
      );
    },
  },
});

export default ReportGraphqlTimingPlugin;
