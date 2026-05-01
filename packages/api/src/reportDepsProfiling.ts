/** Set `REPORT_DEPS_PROFILE=1` for per-phase server timings on report dependency resolution, SubjectReportContext field resolvers, and HTTP GraphQL wall clock. */

export function isReportDepsProfileEnabled(): boolean {
  const v = process.env.REPORT_DEPS_PROFILE;
  return v === "1" || v === "true" || v === "yes";
}

export function reportDepsProfileNowNs(): bigint {
  return process.hrtime.bigint();
}

export function msSinceNs(startNs: bigint): number {
  return Number(process.hrtime.bigint() - startNs) / 1e6;
}

export function reportDepsProfileLog(
  scope: string,
  phase: string,
  startNs: bigint,
  ctx: Record<string, string | number | boolean | undefined>,
  extra?: Record<string, string | number | boolean | undefined>,
): void {
  if (!isReportDepsProfileEnabled()) {
    return;
  }
  const elapsedMs = msSinceNs(startNs);
  const base = {
    ...ctx,
    scope,
    phase,
    elapsedMs: Number(elapsedMs.toFixed(3)),
  };
  const merged = extra ? { ...base, ...extra } : base;
  const parts = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  // eslint-disable-next-line no-console
  console.log(`[report.deps.profile] ${parts.join(" ")}`);
}
