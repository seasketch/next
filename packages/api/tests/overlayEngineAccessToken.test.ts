jest.mock("aws-sdk", () => {
  const getSecretValue = jest.fn();
  return {
    SecretsManager: jest.fn().mockImplementation(() => ({
      getSecretValue: () => ({ promise: getSecretValue }),
    })),
    __getSecretValue: getSecretValue,
  };
});

import AWS from "aws-sdk";
import {
  bustOverlayEngineAccessTokenCache,
  getOverlayEngineAccessToken,
  overlayEngineAccessTokenSecretId,
} from "../src/overlayEngine/overlayEngineAccessToken";

const getSecretValue = (AWS as unknown as { __getSecretValue: jest.Mock })
  .__getSecretValue;

const ENV_KEYS = ["NODE_ENV", "OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN"] as const;

describe("overlay-engine access token secret id", () => {
  const original: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
    {};

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
    bustOverlayEngineAccessTokenCache();
    getSecretValue.mockReset();
  });

  test("uses OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN when set", () => {
    process.env.NODE_ENV = "development";
    process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN =
      "arn:aws:secretsmanager:us-west-1:1:secret:example";
    expect(overlayEngineAccessTokenSecretId()).toBe(
      "arn:aws:secretsmanager:us-west-1:1:secret:example",
    );
  });

  test("an explicit override wins over the environment", () => {
    process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN = "from-env";
    expect(overlayEngineAccessTokenSecretId("from-caller")).toBe("from-caller");
  });

  test("outside production, an unset ARN does not name the production secret", () => {
    process.env.NODE_ENV = "development";
    delete process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;
    expect(overlayEngineAccessTokenSecretId()).toBeNull();
  });

  test("production without an ARN does not name the production secret", () => {
    process.env.NODE_ENV = "production";
    delete process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;
    expect(overlayEngineAccessTokenSecretId()).toBeNull();
  });

  test("getOverlayEngineAccessToken throws in production when the ARN is unset", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;

    await expect(getOverlayEngineAccessToken()).rejects.toThrow(
      "Overlay-engine access token is misconfigured: OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN is not set",
    );
    expect(AWS.SecretsManager).not.toHaveBeenCalled();
  });

  test("getOverlayEngineAccessToken does not call Secrets Manager when unset outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;

    await expect(getOverlayEngineAccessToken()).resolves.toBeNull();
    expect(AWS.SecretsManager).not.toHaveBeenCalled();
    expect(getSecretValue).not.toHaveBeenCalled();
  });
});
