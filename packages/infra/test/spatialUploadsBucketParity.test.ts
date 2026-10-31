import {
  bucketMismatches,
  ecsTaskEnvValue,
  lambdaEnvValue,
  mismatchReport,
} from "../lib/spatialUploadsBucketParity";

const graphqlTemplate = {
  Resources: {
    Role: { Type: "AWS::IAM::Role", Properties: {} },
    TaskDef: {
      Type: "AWS::ECS::TaskDefinition",
      Properties: {
        ContainerDefinitions: [
          {
            Name: "web",
            Environment: [
              { Name: "PGHOST", Value: "db.example" },
              {
                Name: "SPATIAL_UPLOADS_BUCKET",
                Value: "ssn-spatial-uploads-tmp",
              },
            ],
          },
        ],
      },
    },
  },
};

const lambdaTemplate = {
  Resources: {
    Fn: {
      Type: "AWS::Lambda::Function",
      Properties: {
        Environment: {
          Variables: {
            BUCKET: "seasketchdatauploadsstack-datauploads-abc",
            TILES_REMOTE: "r2://ssn-tiles",
          },
        },
      },
    },
  },
};

describe("ecsTaskEnvValue", () => {
  test("finds the env var on the task definition", () => {
    expect(ecsTaskEnvValue(graphqlTemplate, "SPATIAL_UPLOADS_BUCKET")).toBe(
      "ssn-spatial-uploads-tmp"
    );
  });

  test("returns undefined for missing vars and malformed templates", () => {
    expect(ecsTaskEnvValue(graphqlTemplate, "NOPE")).toBeUndefined();
    expect(ecsTaskEnvValue(undefined, "X")).toBeUndefined();
    expect(ecsTaskEnvValue(null, "X")).toBeUndefined();
    expect(ecsTaskEnvValue("string", "X")).toBeUndefined();
    expect(ecsTaskEnvValue({ Resources: { A: 1 } }, "X")).toBeUndefined();
    expect(
      ecsTaskEnvValue(
        { Resources: { T: { Type: "AWS::ECS::TaskDefinition" } } },
        "X"
      )
    ).toBeUndefined();
  });

  test("ignores intrinsic (non-string) values", () => {
    const template = {
      Resources: {
        T: {
          Type: "AWS::ECS::TaskDefinition",
          Properties: {
            ContainerDefinitions: [
              {
                Environment: [
                  { Name: "SPATIAL_UPLOADS_BUCKET", Value: { Ref: "Bucket" } },
                ],
              },
            ],
          },
        },
      },
    };
    expect(ecsTaskEnvValue(template, "SPATIAL_UPLOADS_BUCKET")).toBeUndefined();
  });
});

describe("lambdaEnvValue", () => {
  test("finds the env var on the function", () => {
    expect(lambdaEnvValue(lambdaTemplate, "BUCKET")).toBe(
      "seasketchdatauploadsstack-datauploads-abc"
    );
  });

  test("returns undefined for missing vars and malformed templates", () => {
    expect(lambdaEnvValue(lambdaTemplate, "NOPE")).toBeUndefined();
    expect(lambdaEnvValue(undefined, "BUCKET")).toBeUndefined();
    expect(lambdaEnvValue({}, "BUCKET")).toBeUndefined();
    expect(
      lambdaEnvValue(
        { Resources: { F: { Type: "AWS::Lambda::Function", Properties: {} } } },
        "BUCKET"
      )
    ).toBeUndefined();
  });
});

describe("bucketMismatches", () => {
  test("is empty when everything agrees or nothing is deployed", () => {
    expect(
      bucketMismatches("ssn-spatial-uploads-tmp", {
        graphql: "ssn-spatial-uploads-tmp",
        uploadHandler: "ssn-spatial-uploads-tmp",
      })
    ).toEqual([]);
    expect(bucketMismatches("ssn-spatial-uploads-tmp", {})).toEqual([]);
  });

  test("reports the October 2026 drift", () => {
    const mismatches = bucketMismatches("ssn-spatial-uploads-tmp", {
      graphql: "ssn-spatial-uploads-tmp",
      uploadHandler: "seasketchdatauploadsstack-datauploads-abc",
    });
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toContain("SpatialUploadHandler");
    expect(mismatches[0]).toContain(
      "seasketchdatauploadsstack-datauploads-abc"
    );
  });

  test("reports a stale local value against the deployed API", () => {
    const mismatches = bucketMismatches(
      "seasketchdatauploadsstack-datauploads-abc",
      {
        graphql: "ssn-spatial-uploads-tmp",
        uploadHandler: "seasketchdatauploadsstack-datauploads-abc",
      }
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toContain("SeaSketchGraphQLServer");
  });

  test("report names the expected value and the bypass", () => {
    const report = mismatchReport("ssn-spatial-uploads-tmp", [
      "SpatialUploadHandler is deployed with BUCKET=old",
    ]);
    expect(report).toContain("SPATIAL_UPLOADS_BUCKET=ssn-spatial-uploads-tmp");
    expect(report).toContain("BUCKET=old");
    expect(report).toContain("SKIP_SPATIAL_UPLOADS_BUCKET_CHECK");
  });
});
