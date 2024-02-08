/**
 * The Deffered class represents a promise that can be resolved or rejected
 * outside of the promise executor function. Consumers can also access the
 * isResolved property to check if the promise has been resolved.
 */
export class Deferred<T> {
  /** The promise of interest */
  promise: Promise<T>;
  /** Can be used by any consumer to resolve the deferred promise */
  resolve?: (value: T) => void;
  /** Can be used by any consumer to reject the deferred promise */
  reject?: (reason?: any) => void;
  /** Whether the promise has been resolved */
  isResolved = false;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = (value: T) => {
        this.isResolved = true;
        resolve(value);
      };
    });
  }
}
