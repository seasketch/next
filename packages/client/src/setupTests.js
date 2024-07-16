import "@testing-library/jest-dom";

beforeEach(() => {
  // Silence apollo inmemorycache console.error calls based on incomplete mocks
  jest.spyOn(console, "error").mockImplementation((e) => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
