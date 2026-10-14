import {
  assertSourcesStillPresent,
  imageRefInRepository,
  planTagChanges,
  resolveRunningDigests,
  sourceIds,
  type ImageRef,
  type RepoImage,
} from "../lambdas/ecrImageRetention/plan";

const DIGEST_A = "sha256:" + "a".repeat(64);
const DIGEST_B = "sha256:" + "b".repeat(64);
const DIGEST_C = "sha256:" + "c".repeat(64);
const NOW = new Date("2026-10-14T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function image(partial: Partial<RepoImage> & Pick<RepoImage, "digest">): RepoImage {
  return {
    pushedAt: daysAgo(40),
    tags: ["hash"],
    ...partial,
  };
}

describe("imageRefInRepository", () => {
  const repo = "cdk-hnb659fds-container-assets-196230260133-us-west-2";

  test("reads a tag from an ECR image URI", () => {
    expect(
      imageRefInRepository(
        `196230260133.dkr.ecr.us-west-2.amazonaws.com/${repo}:abc123`,
        repo
      )
    ).toEqual({ tag: "abc123" });
  });

  test("reads a digest pin", () => {
    expect(
      imageRefInRepository(
        `196230260133.dkr.ecr.us-west-2.amazonaws.com/${repo}@sha256:abc`,
        repo
      )
    ).toEqual({ digest: "sha256:abc" });
  });

  test("ignores a different repository", () => {
    expect(
      imageRefInRepository(
        "196230260133.dkr.ecr.us-west-2.amazonaws.com/aws-cdk/assets:abc",
        repo
      )
    ).toBeNull();
  });
});

describe("assertSourcesStillPresent", () => {
  const previous = [
    "ecs:SeaSketchGraphQLServer-GraphQLServerService",
    "ecs:SeaSketchMaintenanceBastion-SeaSketchMaintenanceService",
    "lambda:DataTablesHandler",
    "lambda:GeostatsPiiClassifier",
    "lambda:SpatialUploadsHandler",
    "lambda:SubdivisionWorker",
  ];

  test("accepts a new image Lambda without a code change", () => {
    expect(() =>
      assertSourcesStillPresent({
        previous,
        current: [...previous, "lambda:SomeNewImageHandler"].sort(),
      })
    ).not.toThrow();
  });

  test("accepts the first run, when nothing has been recorded yet", () => {
    expect(() =>
      assertSourcesStillPresent({
        previous: null,
        current: ["lambda:DataTablesHandler"],
      })
    ).not.toThrow();
  });

  test("refuses an empty discovery", () => {
    expect(() =>
      assertSourcesStillPresent({ previous, current: [] })
    ).toThrow(/No running images/);
  });

  test("refuses when most previously seen sources disappear", () => {
    expect(() =>
      assertSourcesStillPresent({
        previous,
        current: ["lambda:DataTablesHandler"],
      })
    ).toThrow(/DataTablesHandler|GraphQLServer|not seen/);
  });
});

describe("sourceIds", () => {
  test("names Lambda and ECS sources so either kind can be added later", () => {
    expect(
      sourceIds({
        lambdaNamesFound: ["DataTablesHandler"],
        ecsServiceNames: ["SeaSketchGraphQLServer-GraphQLServerService"],
      })
    ).toEqual([
      "ecs:SeaSketchGraphQLServer-GraphQLServerService",
      "lambda:DataTablesHandler",
    ]);
  });
});

describe("planTagChanges", () => {
  const running = new Set([DIGEST_A]);
  const images: RepoImage[] = [
    image({ digest: DIGEST_A, pushedAt: daysAgo(100), tags: ["live", "old-" + "a".repeat(64)] }),
    image({ digest: DIGEST_B, pushedAt: daysAgo(10), tags: ["recent"] }),
    image({ digest: DIGEST_C, pushedAt: daysAgo(40), tags: ["stale"] }),
  ];

  test("clears old- from a running image and marks only unused images past retention", () => {
    const plan = planTagChanges({ runningDigests: running, images, now: NOW });
    expect(plan.removeOldTags).toEqual([
      { digest: DIGEST_A, tag: "old-" + "a".repeat(64) },
    ]);
    expect(plan.markOld).toEqual([
      { digest: DIGEST_C, tag: "old-" + "c".repeat(64) },
    ]);
  });

  test("does not mark an image that is already tagged old-", () => {
    const plan = planTagChanges({
      runningDigests: new Set(),
      images: [image({ digest: DIGEST_C, tags: ["stale", "old-" + "c".repeat(64)] })],
      now: NOW,
    });
    expect(plan.markOld).toEqual([]);
    expect(plan.removeOldTags).toEqual([]);
  });

  test("does not mark an unused image with no push date", () => {
    const plan = planTagChanges({
      runningDigests: new Set(),
      images: [image({ digest: DIGEST_C, pushedAt: undefined, tags: ["stale"] })],
      now: NOW,
    });
    expect(plan.markOld).toEqual([]);
  });
});

describe("resolveRunningDigests", () => {
  const images: RepoImage[] = [
    image({ digest: DIGEST_A, tags: ["live"] }),
  ];

  test("resolves a deployed tag to its digest", () => {
    const refs: ImageRef[] = [{ source: "ecs graphql/web", tag: "live" }];
    expect([...resolveRunningDigests(refs, images)]).toEqual([DIGEST_A]);
  });

  test("throws when a deployed tag is missing, instead of treating it as unused", () => {
    const refs: ImageRef[] = [{ source: "lambda DataTablesHandler", tag: "missing" }];
    expect(() => resolveRunningDigests(refs, images)).toThrow(/DataTablesHandler/);
  });
});
