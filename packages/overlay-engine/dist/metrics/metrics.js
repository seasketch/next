"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectIsFragment = subjectIsFragment;
exports.subjectIsGeography = subjectIsGeography;
function subjectIsFragment(subject) {
    return "hash" in subject;
}
function subjectIsGeography(subject) {
    return "id" in subject;
}
//# sourceMappingURL=metrics.js.map