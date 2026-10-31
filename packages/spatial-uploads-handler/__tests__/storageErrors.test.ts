import {
  describeStorageError,
  extractErrorDetails,
  storageErrorHint,
  toError,
} from "../src/storageErrors";

class SdkError extends Error {
  $metadata: { httpStatusCode?: number };
  Code?: string;
  constructor(
    name: string,
    httpStatusCode?: number,
    message?: string,
    Code?: string
  ) {
    super(message ?? name);
    this.name = name;
    this.$metadata = { httpStatusCode };
    this.Code = Code;
  }
}

describe("extractErrorDetails", () => {
  test("handles null, undefined and primitives", () => {
    expect(extractErrorDetails(null)).toEqual({});
    expect(extractErrorDetails(undefined)).toEqual({});
    expect(extractErrorDetails("boom")).toEqual({ message: "boom" });
    expect(extractErrorDetails(42)).toEqual({ message: "42" });
  });

  test("reads sdk v3 metadata", () => {
    const details = extractErrorDetails(new SdkError("NotFound", 404));
    expect(details.name).toBe("NotFound");
    expect(details.httpStatusCode).toBe(404);
  });

  test("drops the sdk's UnknownError placeholder message", () => {
    const details = extractErrorDetails(
      new SdkError("NotFound", 404, "UnknownError")
    );
    expect(details.message).toBeUndefined();
    expect(
      describeStorageError(
        "fetch",
        "r2://b/k",
        new SdkError("NotFound", 404, "UnknownError")
      )
    ).toMatch(/^Failed to fetch r2:\/\/b\/k: NotFound \(HTTP 404\)\./);
  });

  test("reads node network codes from cause", () => {
    const err = new TypeError("fetch failed") as Error & { cause?: unknown };
    err.cause = { code: "ECONNREFUSED" };
    expect(extractErrorDetails(err).code).toBe("ECONNREFUSED");
  });
});

describe("describeStorageError", () => {
  test("missing bucket or object points at the bucket configuration", () => {
    const message = describeStorageError(
      "fetch",
      "r2://seasketchdatauploadsstack-xyz/abc/file.geojson",
      new SdkError("NotFound", 404)
    );
    expect(message).toContain(
      "Failed to fetch r2://seasketchdatauploadsstack-xyz/abc/file.geojson"
    );
    expect(message).toContain("NotFound (HTTP 404)");
    expect(message).toContain("SPATIAL_UPLOADS_BUCKET");
  });

  test("NoSuchBucket without a status code still gets the hint", () => {
    const message = describeStorageError(
      "upload",
      "r2://missing/key",
      new SdkError(
        "NoSuchBucket",
        undefined,
        "The specified bucket does not exist"
      )
    );
    expect(message).toContain("Failed to upload to r2://missing/key");
    expect(message).toContain(
      "NoSuchBucket: The specified bucket does not exist"
    );
    expect(message).toContain("does not exist");
  });

  test("credential failures mention the R2 credentials", () => {
    const message = describeStorageError(
      "fetch",
      "r2://bucket/key",
      new SdkError("AccessDenied", 403)
    );
    expect(message).toContain("R2_ACCESS_KEY_ID");
  });

  test("network failures mention the endpoint", () => {
    const err = Object.assign(new Error("getaddrinfo ENOTFOUND example"), {
      code: "ENOTFOUND",
    });
    const message = describeStorageError("fetch", "r2://bucket/key", err);
    expect(message).toContain("ENOTFOUND");
    expect(message).toContain("R2_ENDPOINT");
  });

  test("server errors are flagged as transient", () => {
    const message = describeStorageError(
      "fetch",
      "r2://bucket/key",
      new SdkError("InternalError", 500)
    );
    expect(message).toContain("HTTP 500");
    expect(message).toContain("transient");
  });

  test("unknown errors still name the operation and remote", () => {
    expect(describeStorageError("head", "r2://bucket/key", undefined)).toBe(
      "Failed to read metadata for r2://bucket/key: Unknown error."
    );
    expect(describeStorageError("fetch", "r2://bucket/key", "oops")).toBe(
      "Failed to fetch r2://bucket/key: oops."
    );
  });

  test("storageErrorHint returns undefined when nothing matches", () => {
    expect(storageErrorHint({ name: "SomethingElse" })).toBeUndefined();
  });
});

describe("toError", () => {
  test("passes Errors through and fills empty messages", () => {
    const err = new Error("x");
    expect(toError(err)).toBe(err);
    const empty = new Error("");
    empty.name = "NotFound";
    expect(toError(empty).message).toBe("NotFound");
  });

  test("wraps non-errors", () => {
    expect(toError("text").message).toBe("text");
    expect(toError({ a: 1 }).message).toBe('Unknown error: {"a":1}');
    expect(toError(undefined).message).toBe("Unknown error: undefined");
  });
});
