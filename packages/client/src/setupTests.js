import { TextDecoder, TextEncoder } from "util";
import "@testing-library/jest-dom";

// jsdom in this Jest version does not provide the encoding globals that
// fgb-source uses while loading overlay-engine.
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}

beforeEach(() => {
  // Silence apollo inmemorycache console.error calls based on incomplete mocks
  jest.spyOn(console, "error").mockImplementation((e) => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
