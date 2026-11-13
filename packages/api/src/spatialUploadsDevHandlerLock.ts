/**
 * The local Lambda runtime emulator accepts one invoke at a time. A second
 * POST while the first is still running logs `ReserveFailed: AlreadyReserved`
 * and then nil-pointer panics, which exits the container and kills the
 * in-flight upload. Production invokes are asynchronous and do not take this
 * lock. Callers share one chain so a feature-layer conversion and a data
 * upload cannot hit the emulator together either.
 */
let chain: Promise<unknown> = Promise.resolve();

export function withSpatialUploadsDevHandler<T>(
  run: () => Promise<T>,
): Promise<T> {
  const result = chain.then(run, run);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
