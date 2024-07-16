import debounce from "lodash.debounce";
import { spawn } from "node:child_process";

/**
 * Logger class that captures stdout/stderr while executing command line tasks
 * and updates progress.
 */
export class Logger {
  output: string;
  updateProgress: (increment: number) => Promise<void> | undefined;
  currentProgress = 0;

  constructor(updateProgress: (progress: number) => Promise<void>) {
    this.output = "";
    const self = this;
    const doUpdate = debounce(
      async (progress: number) => {
        return updateProgress(progress);
      },
      100,
      {
        maxWait: 200,
      }
    );
    this.updateProgress = async (increment: number) => {
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
  async exec(
    command: [string, string[]],
    throwMsg: string,
    progressFraction?: number
  ): Promise<string> {
    let stdout = "";
    const self = this;
    return new Promise((resolve, reject) => {
      let progress = 0;
      self.output += `${command[0]} ${command[1].join(" ")}\n`;
      const child = spawn(command[0], command[1]);

      const progressRegExp = /([\d\.]+)%/;

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", function (data) {
        if (progressFraction && progressRegExp.test(data.toString())) {
          const newProgress = parseFloat(
            data.toString().match(progressRegExp)[1]
          );
          const increment = newProgress - progress;
          progress = newProgress;
          self.updateProgress((increment / 100) * progressFraction);
        }
        stdout += data.toString();
        self.output += data.toString() + "\n";
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", function (data) {
        if (
          data.indexOf("ERROR 1: ICreateFeature: Mismatched geometry type") !=
          -1
        ) {
          reject(
            new Error("ERROR 1: ICreateFeature: Mismatched geometry type")
          );
        }
        if (progressFraction && progressRegExp.test(data.toString())) {
          const newProgress = parseFloat(
            data.toString().match(progressRegExp)[1]
          );
          const increment = newProgress - progress;
          progress = newProgress;
          self.updateProgress((increment / 100) * progressFraction);
        }
        self.output += data.toString() + "\n";
      });

      child.on("close", async function (code) {
        if (code !== 0) {
          reject(new Error(throwMsg));
        } else {
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
