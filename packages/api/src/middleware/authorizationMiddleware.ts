import jwt from "express-jwt";
import jwksRsa from "jwks-rsa";

/**
 * Validates Bearer Authorization header via auth0 and assigns claims to req.user
 */
const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: process.env.JWKS_URI!,
  }),
  audience: process.env.JWT_AUD,
  issuer: process.env.JWT_ISS,
  algorithms: ["RS256"],
  credentialsRequired: false,
  getToken: (req) => {
    if ("normalizedConnectionParams" in req) {
      // websocket connection
      // @ts-ignore
      return req.normalizedConnectionParams["authorization"]?.split(
        "Bearer "
      )[1];
    } else {
      // normal post or get request
      return (
        // @ts-ignore
        req.query["token"] || req.header("authorization")?.split("Bearer ")[1]
      );
    }
    return undefined;
  },
});

export default jwtCheck;
