import {
  MisconfiguredError,
  throwIfProductionMisconfigured,
} from "../src/env";

describe("production misconfiguration", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  test("does not throw outside production", () => {
    process.env.NODE_ENV = "development";
    expect(() =>
      throwIfProductionMisconfigured("Overlay report consumer", [
        "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL",
      ]),
    ).not.toThrow();
  });

  test("throws a descriptive error in production when a setting is missing", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      throwIfProductionMisconfigured("Overlay report consumer", [
        "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL",
      ]),
    ).toThrow(MisconfiguredError);
    expect(() =>
      throwIfProductionMisconfigured("Overlay report consumer", [
        "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL",
      ]),
    ).toThrow(
      "Overlay report consumer is misconfigured: OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL is not set",
    );
  });

  test("does not throw in production when nothing is missing", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      throwIfProductionMisconfigured("Overlay report consumer", []),
    ).not.toThrow();
  });
});
