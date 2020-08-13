const patterns = {
  esriSLSDash: (strokeWidth: number) => [2, 0.5],
  esriSLSDashDot: (strokeWidth: number) => [3, 1, 1, 1],
  esriSLSDashDotDot: (strokeWidth: number) => [3, 1, 1, 1, 1, 1],
  esriSLSNull: () => [0, 10],
  esriSLSDot: (strokeWidth: number) => [1, 1],
};

export default patterns;
