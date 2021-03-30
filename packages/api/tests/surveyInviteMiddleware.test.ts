import { IncomingRequest } from "../src/middleware/IncomingRequest";
import { createAndSendSurveyInvite, asPg } from "./helpers";
import middleware from "../src/middleware/surveyInviteMiddleware";
import { createPool } from "./pool";
import { rotateKeys } from "../src/auth/jwks";
import { sql } from "slonik";
import getPool from "../src/pool";
import { Pool } from "pg";

const pool = createPool("test");
let pool2: Pool;

beforeAll(async () => {
  pool2 = await getPool();
  await rotateKeys(asPg(pool));
});

test("invite token claims are assigned from `x-ss-survey-invite-token`", async (done) => {
  await createAndSendSurveyInvite(
    pool,
    "PUBLIC",
    async (conn, projectId, adminId, userA, surveyId, inviteId) => {
      const { token, to_address } = await conn.one(
        sql`select token, to_address from invite_emails`
      );
      const pem = await conn.oneFirst(
        sql`select public_pem from jwks order by created_at desc limit 1`
      );
      // @ts-ignore
      pool2.add("select get_public_jwk($1)", ["string"], {
        rowCount: 1,
        rows: [{ get_public_jwk: pem }],
      });
      // @ts-ignore
      pool2.add("select survey_invite_was_used($1)", ["number"], {
        rowCount: 1,
        rows: [{ survey_invite_was_used: false }],
      });
      // @ts-ignore
      pool2.add("select * from survey_validation_info($1)", ["number"], {
        rowCount: 1,
        rows: [{ is_disabled: false, limit_to_single_response: false }],
      });
      const req = ({
        headers: {
          "x-ss-survey-invite-token": token,
        },
      } as unknown) as IncomingRequest;
      // @ts-ignore
      middleware(req, {}, () => {
        expect(req.surveyInvite).toBeTruthy();
        expect(req.surveyInvite?.email).toBe(to_address);
        done();
      });
    }
  );
});

test("invalid tokens are ignored", (done) => {
  const req = ({
    headers: {
      "x-ss-survey-invite-token": "abc123",
    },
  } as unknown) as IncomingRequest;
  // @ts-ignore
  middleware(req, {}, () => {
    expect(req.surveyInvite).toBeUndefined();
    done();
  });
});
