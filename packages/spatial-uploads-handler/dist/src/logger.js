"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const lodash_debounce_1 = __importDefault(require("lodash.debounce"));
const node_child_process_1 = require("node:child_process");
const DEBUG = process.env.DEBUG === "true";
/**
 * Logger class that captures stdout/stderr while executing command line tasks
 * and updates progress.
 */
class Logger {
    constructor(updateProgress) {
        this.currentProgress = 0;
        this.output = "";
        const self = this;
        const doUpdate = (0, lodash_debounce_1.default)(async (progress) => {
            return updateProgress(progress);
        }, 100, {
            maxWait: 200,
        });
        this.updateProgress = async (increment) => {
            self.currentProgress += increment;
            return doUpdate(self.currentProgress);
        };
    }
    /**
     *
     * @param command String Command to run
     * @param throwMsg String If the process exists with a status code other than 0, this message will be thrown
     * @param progressFraction Float If provided, the `updateProgress` function will be called to increment progress on the upload task record. If the Logger detects progress messages from the script in stdout/err, it will update accordingly. If not, it will simply increment the progress by this fraction once the entire command completes.
     * @returns
     */
    async exec(command, throwMsg, progressFraction) {
        let stdout = "";
        const self = this;
        if (DEBUG) {
            console.log(`Running command: ${command[0]} ${command[1].join(" ")}`);
        }
        return new Promise((resolve, reject) => {
            let progress = 0;
            self.output += `${command[0]} ${command[1].join(" ")}\n`;
            const child = (0, node_child_process_1.spawn)(command[0], command[1]);
            const progressRegExp = /([\d\.]+)%/;
            child.stdout.setEncoding("utf8");
            child.stdout.on("data", function (data) {
                if (progressFraction && progressRegExp.test(data.toString())) {
                    const newProgress = parseFloat(data.toString().match(progressRegExp)[1]);
                    const increment = newProgress - progress;
                    progress = newProgress;
                    self.updateProgress((increment / 100) * progressFraction);
                }
                stdout += data.toString();
                self.output += data.toString() + "\n";
                if (DEBUG) {
                    console.log(data.toString());
                }
            });
            child.stderr.setEncoding("utf8");
            child.stderr.on("data", function (data) {
                if (data.indexOf("ERROR 1: ICreateFeature: Mismatched geometry type") !=
                    -1) {
                    reject(new Error("ERROR 1: ICreateFeature: Mismatched geometry type"));
                }
                if (progressFraction && progressRegExp.test(data.toString())) {
                    const newProgress = parseFloat(data.toString().match(progressRegExp)[1]);
                    const increment = newProgress - progress;
                    progress = newProgress;
                    self.updateProgress((increment / 100) * progressFraction);
                }
                self.output += data.toString() + "\n";
                if (DEBUG) {
                    console.error(data.toString());
                }
            });
            child.on("close", async function (code) {
                if (code !== 0) {
                    reject(new Error(throwMsg));
                }
                else {
                    if (progress === 0) {
                        if (progressFraction) {
                            await self.updateProgress(progressFraction);
                        }
                    }
                    resolve(stdout);
                }
            });
        });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map