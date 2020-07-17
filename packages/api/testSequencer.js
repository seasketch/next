const Sequencer = require("@jest/test-sequencer").default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Test structure information
    // https://github.com/facebook/jest/blob/6b8b1404a1d9254e7d5d90a8934087a9c9899dab/packages/jest-runner/src/types.ts#L17-L21
    const copyTests = Array.from(tests);
    const sorted = copyTests.sort((testA, testB) => {
      const filenameA = testA.path.split("/").slice(-1)[0];
      const filenameB = testB.path.split("/").slice(-1)[0];
      return filenameA[0].localeCompare(filenameB[0]);
    });
    const withold = [];
    const resorted = [];
    const tail = [];
    for (const item of sorted) {
      if (/jwks/.test(item.path)) {
        withold.push(item);
      } else if (/surveyInviteMiddleware/.test(item.path)) {
        tail.push(item);
      } else {
        resorted.push(item);
      }
    }

    return [...withold, ...resorted, ...tail].reverse();
  }
}
module.exports = CustomSequencer;
