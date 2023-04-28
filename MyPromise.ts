type ResolveHandler = (result: unknown) => void;
type RejectHandler = (reason: unknown) => void;
type OnFulfilledHandler = (result: unknown) => void;
type OnRejectedHandler = (reason: unknown) => void;

type Executor = (resolve: ResolveHandler, reject: RejectHandler) => void;

enum PromiseState {
  PENDING = "PENDING",
  FULFILLED = "FULFILLED",
  REJECTED = "REJECTED",
}

const isObject = (val: unknown) =>
  Object.prototype.toString.call(val).slice(8, -1) === "Object";

class MyPromise {
  private _state = PromiseState.PENDING;
  private _value: unknown = null;
  private _reason: unknown = null;
  private _onFulfilledQueue: CallableFunction[] = [];
  private _onRejectedQueue: CallableFunction[] = [];
  // _resolve方法用于将state变为fulfilled
  private _resolve: ResolveHandler = (val) => {
    if (this._state === PromiseState.PENDING) {
      this._state = PromiseState.FULFILLED;
      this._value = val;
      while (this._onFulfilledQueue.length) {
        const cb = this._onFulfilledQueue.shift();
        typeof cb === "function" && cb(this._value);
      }
    }
  };
  // _reject方法用于将state变为reject
  private _reject: RejectHandler = (reason) => {
    if (this._state === PromiseState.PENDING) {
      this._state = PromiseState.REJECTED;
      this._reason = reason;
      while (this._onRejectedQueue.length) {
        const cb = this._onRejectedQueue.shift();
        typeof cb === "function" && cb(this._reason);
      }
    }
  };

  constructor(executor: Executor) {
    executor(this._resolve, this._reject);
  }

  then(onFulfilled?: OnFulfilledHandler, onRejected?: OnRejectedHandler) {
    const returnPromise = new MyPromise((resolve, reject) => {
      const fulfilledCallback =
        typeof onFulfilled === "function" ? onFulfilled : (val: unknown) => val;
      const rejectedCallback =
        typeof onRejected === "function"
          ? onRejected
          : (reason: unknown) => {
              throw reason;
            };
      const fulfilledTask = () =>
        queueMicrotask(() => {
          try {
            const x = fulfilledCallback(this._value);
            resolvePromise(x, returnPromise, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      const rejectedTask = () =>
        queueMicrotask(() => {
          try {
            const x = rejectedCallback(this._reason);
            resolvePromise(x, returnPromise, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      switch (this._state) {
        case PromiseState.FULFILLED:
          fulfilledTask();
          break;
        case PromiseState.REJECTED:
          rejectedTask();
          break;
        default:
          this._onFulfilledQueue.push(fulfilledTask);
          this._onRejectedQueue.push(rejectedTask);
          break;
      }
    });
    return returnPromise;
  }
}

const resolvePromise = (
  x: any,
  returnPromise: MyPromise,
  resolve: ResolveHandler,
  reject: RejectHandler
) => {
  if (x === returnPromise) {
    throw new TypeError("Promise has infinite loop");
  } else if (x instanceof MyPromise) {
    x.then(
      (result) => {
        resolvePromise(result, returnPromise, resolve, reject);
      },
      (reason) => {
        reject(reason);
      }
    );
  } else if (isObject(x) || typeof x === "function") {
    let then;
    try {
      then = x.then;
    } catch (error) {
      reject(error);
    }
    if (typeof then === "function") {
      let called = false;
      try {
        then.call(
          x,
          (y: unknown) => {
            if (called === false) {
              called = true;
              resolvePromise(y, returnPromise, resolve, reject);
            }
          },
          (r: unknown) => {
            if (called === false) {
              called = true;
              reject(r);
            }
          }
        );
      } catch (e) {
        if (called === false) {
          reject(e);
        }
      }
    } else {
      resolve(x);
    }
  } else {
    resolve(x);
  }
};

// @ts-ignore
MyPromise.deferred = function () {
  const result: any = {};
  result.promise = new MyPromise(function (resolve, reject) {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
};
module.exports = MyPromise;
