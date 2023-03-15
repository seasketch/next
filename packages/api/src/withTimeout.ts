const rejectAfter = (duration: number) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Timeout"));
    }, duration);
  });
export const withTimeout = (
  duration: number,
  callback: (...args: any) => Promise<any>
) => {
  return (...args: any) => {
    return Promise.race([rejectAfter(duration), callback(...args)]);
  };
};
