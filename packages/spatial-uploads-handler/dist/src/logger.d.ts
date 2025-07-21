/**
 * Logger class that captures stdout/stderr while executing command line tasks
 * and updates progress.
 */
export declare class Logger {
    output: string;
    updateProgress: (increment: number) => Promise<void> | undefined;
    currentProgress: number;
    constructor(updateProgress: (progress: number) => Promise<void>);
    /**
     *
     * @param command String Command to run
     * @param throwMsg String If the process exists with a status code other than 0, this message will be thrown
     * @param progressFraction Float If provided, the `updateProgress` function will be called to increment progress on the upload task record. If the Logger detects progress messages from the script in stdout/err, it will update accordingly. If not, it will simply increment the progress by this fraction once the entire command completes.
     * @returns
     */
    exec(command: [string, string[]], throwMsg: string, progressFraction?: number): Promise<string>;
}
//# sourceMappingURL=logger.d.ts.map