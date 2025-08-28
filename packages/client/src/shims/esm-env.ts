// Minimal shim for esm-env used by @number-flow/react.
// The library checks for `BROWSER` to guard DOM usage.
export const BROWSER = true;
export const NODE = false;
export const DEV = process.env.NODE_ENV !== "production";
