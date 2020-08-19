const patterns = {
    esriSLSDash: (strokeWidth) => [2, 0.5],
    esriSLSDashDot: (strokeWidth) => [3, 1, 1, 1],
    esriSLSDashDotDot: (strokeWidth) => [3, 1, 1, 1, 1, 1],
    esriSLSNull: () => [0, 10],
    esriSLSDot: (strokeWidth) => [1, 1],
};
export default patterns;
