const {
  loadManifest,
  readManifest,
  productionProfileRefusals,
  assertNonProductionProfile,
  isCi,
} = require("../envProfile.js");

const enforced = {
  variables: [
    {
      name: "TILES_ACL_NAMESPACE",
      class: "per-environment-name",
      packages: ["api"],
      requiredBy: ["core"],
      description: "example",
    },
  ],
  profiles: {
    "seasketch.org": {
      forbidden: [
        { name: "TILES_ACL_NAMESPACE", equals: "prod", enforce: true },
        {
          name: "JWT_ISS",
          equals: "https://seasketch.auth0.com/",
          enforce: false,
        },
      ],
    },
  },
};

describe("env manifest", () => {
  test("rejects null, undefined, and non-objects", () => {
    expect(() => loadManifest(null)).toThrow(/must be an object/);
    expect(() => loadManifest(undefined)).toThrow(/must be an object/);
    expect(() => loadManifest("prod")).toThrow(/must be an object/);
    expect(() => loadManifest([])).toThrow(/must be an object/);
  });

  test("rejects a profile with a malformed forbidden entry", () => {
    expect(() =>
      loadManifest({
        variables: enforced.variables,
        profiles: {
          "seasketch.org": {
            forbidden: [{ name: "TILES_ACL_NAMESPACE" }],
          },
        },
      }),
    ).toThrow(/forbidden entries/);
  });

  test("accepts a manifest with an enforced value and a recorded one", () => {
    expect(loadManifest(enforced)).toBe(enforced);
  });

  test("the committed manifest enforces the tile namespace and the production Auth0 issuer", () => {
    const manifest = readManifest();
    const forbidden = manifest.profiles["seasketch.org"].forbidden;
    const tiles = forbidden.find(
      (entry: { name: string }) => entry.name === "TILES_ACL_NAMESPACE",
    );
    const issuer = forbidden.find(
      (entry: { name: string }) => entry.name === "JWT_ISS",
    );
    expect(tiles).toMatchObject({ equals: "prod", enforce: true });
    expect(issuer).toMatchObject({
      equals: "https://seasketch.auth0.com/",
      enforce: true,
    });
    const recorded = forbidden
      .filter((entry: { enforce: boolean }) => !entry.enforce)
      .map((entry: { name: string }) => entry.name)
      .sort();
    // The data-path production values are recorded, not enforced: a developer
    // may point storage at production. CI refuses them (strict mode below).
    expect(recorded).toEqual([
      "R2_TILES_BUCKET",
      "SPATIAL_UPLOADS_BUCKET",
      "TILES_BASE_URL",
      "TILES_REMOTE",
      "UPLOADS_BASE_URL",
    ]);
  });

  test("strict mode refuses recorded values as well", () => {
    expect(
      productionProfileRefusals(
        { JWT_ISS: "https://seasketch.auth0.com" },
        enforced,
        { strict: true },
      ),
    ).toEqual(["JWT_ISS is the seasketch.org production value https://seasketch.auth0.com/"]);
    expect(
      productionProfileRefusals(
        { UPLOADS_BASE_URL: "https://uploads.seasketch.org/" },
        readManifest(),
        { strict: true },
      ),
    ).toEqual([
      "UPLOADS_BASE_URL is the seasketch.org production value https://uploads.seasketch.org",
    ]);
    expect(
      productionProfileRefusals(
        { UPLOADS_BASE_URL: "https://uploads.seasketch.org/" },
        readManifest(),
      ),
    ).toEqual([]);
  });

  test("isCi reads the CI variable the way GitHub Actions sets it", () => {
    expect(isCi({ CI: "true" })).toBe(true);
    expect(isCi({ CI: "1" })).toBe(true);
    expect(isCi({ CI: "false" })).toBe(false);
    expect(isCi({ CI: "" })).toBe(false);
    expect(isCi({})).toBe(false);
  });

  test("refuses an enforced production value and ignores one that is not enforced yet", () => {
    expect(
      productionProfileRefusals(
        { TILES_ACL_NAMESPACE: "Prod" },
        enforced,
      ),
    ).toEqual([
      "TILES_ACL_NAMESPACE is the seasketch.org production value prod",
    ]);
    expect(
      productionProfileRefusals(
        { JWT_ISS: "https://seasketch.auth0.com" },
        enforced,
      ),
    ).toEqual([]);
    expect(
      productionProfileRefusals({ TILES_ACL_NAMESPACE: "dev-ada" }, enforced),
    ).toEqual([]);
    expect(productionProfileRefusals({}, enforced)).toEqual([]);
  });

  describe("API startup", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalNamespace = process.env.TILES_ACL_NAMESPACE;
    const originalClientNamespace = process.env.REACT_APP_TILES_ACL_NAMESPACE;
    const originalIssuer = process.env.JWT_ISS;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalNamespace === undefined) {
        delete process.env.TILES_ACL_NAMESPACE;
      } else {
        process.env.TILES_ACL_NAMESPACE = originalNamespace;
      }
      if (originalClientNamespace === undefined) {
        delete process.env.REACT_APP_TILES_ACL_NAMESPACE;
      } else {
        process.env.REACT_APP_TILES_ACL_NAMESPACE = originalClientNamespace;
      }
      if (originalIssuer === undefined) {
        delete process.env.JWT_ISS;
      } else {
        process.env.JWT_ISS = originalIssuer;
      }
    });

    test("skips the manifest in production", () => {
      process.env.NODE_ENV = "production";
      process.env.TILES_ACL_NAMESPACE = "prod";
      expect(() => assertNonProductionProfile()).not.toThrow();
    });

    test("refuses the production tile namespace outside production", () => {
      process.env.NODE_ENV = "development";
      process.env.TILES_ACL_NAMESPACE = "prod";
      expect(() => assertNonProductionProfile()).toThrow(
        /TILES_ACL_NAMESPACE/,
      );
    });

    test("refuses the production Auth0 issuer outside production", () => {
      process.env.NODE_ENV = "development";
      process.env.TILES_ACL_NAMESPACE = "dev-ada";
      delete process.env.REACT_APP_TILES_ACL_NAMESPACE;
      process.env.JWT_ISS = "https://seasketch.auth0.com/";
      expect(() => assertNonProductionProfile()).toThrow(/JWT_ISS/);
    });
  });
});
