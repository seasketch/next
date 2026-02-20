"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaHandler = void 0;
const handler_1 = require("./handler");
const lambdaHandler = async (event, context) => {
    try {
        return await (0, handler_1.handleCreateFragments)(event);
    }
    catch (e) {
        console.error(e);
        return { success: false, error: e.message || "Unknown error" };
    }
};
exports.lambdaHandler = lambdaHandler;
process.on("unhandledRejection", (reason, promise) => {
    console.log("Unhandled rejection", reason, promise);
});
//# sourceMappingURL=lambda.js.map