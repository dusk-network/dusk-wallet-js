const ACTIONS = {
  SET_WASM_EXPORT: 0,
  CALL_FUNCTION_EXPORT: 1,
  RUN_FUNCTION: 2,
  CLOSE: 3,
};

export class WasmWorker {
  constructor(module) {
    this.module = module;
    this.current = 0;
    this.workerPromise = [];
  }

  call(func, args) {
    const workerModuleSource = `const ACTIONS=${JSON.stringify(
      ACTIONS
    )};let moduleInstance = null;onmessage=${workerFunc};`;

    const worker = new Worker(
      `data:text/javascript;base64,${btoa(workerModuleSource)}`,
      {
        type: "module",
      }
    );

    worker.postMessage({
      id: this.current,
      action: ACTIONS.SET_WASM_EXPORT,
      payload: {
        exports: this.module,
      },
    });

    worker.onmessage = (e) => {
      const { id, result, action, payload } = e.data;

      if (action !== ACTIONS.SET_WASM_EXPORT) {
        this.workerPromise[id][result](payload);
        this.workerPromise[id] = null;
      }
    };

    return new Promise((...params) => {
      this.current = this.current + 1;
      this.workerPromise[this.current] = [...params];

      worker.postMessage({
        id: this.current,
        action: ACTIONS.CALL_FUNCTION_EXPORT,
        payload: {
          func: func,
          args: args,
        },
      });
    }).catch((e) => console.log(e));
  }
}

function workerFunc(e) {
  const { id, action, payload } = e.data;

  const sendMessage = (result, data) => {
    self.postMessage({
      id,
      action,
      result,
      payload: data,
    });
  };

  function alloc(wasm, bytes) {
    const length = bytes.byteLength;

    try {
      const ptr = wasm.allocate(length);
      const mem = new Uint8Array(wasm.memory.buffer, ptr, length);

      mem.set(new Uint8Array(bytes));
      return ptr;
    } catch (error) {
      throw new Error("Error allocating memory in wasm: ", +error);
    }
  }

  function getAndFree(wasm, result) {
    try {
      const mem = new Uint8Array(wasm.memory.buffer, result.ptr, result.length);

      wasm.free_mem(result.ptr, result.length);
      return mem;
    } catch (e) {
      throw new Error("Error while freeing memory: " + e);
    }
  }

  function decompose(result) {
    const ptr = result >> 32n;
    const len = ((result << 32n) & ((1n << 64n) - 1n)) >> 40n;
    const success = ((result << 63n) & ((1n << 64n) - 1n)) >> 63n == 0n;

    return {
      ptr: Number(ptr.toString()),
      length: Number(len.toString()),
      status: success,
    };
  }

  // eslint-disable-next-line
  const onError = (ex) => sendMessage(1, "" + ex);
  const onSuccess = sendMessage.bind(null, 0);

  if (action === ACTIONS.CALL_FUNCTION_EXPORT) {
    const { func, args } = payload;

    Promise.resolve()
      .then(() => {
        WebAssembly.instantiate(moduleInstance, {
          env: {
            panic: function (ptr, len) {
              console.log("Panic called", ptr, len);
            },
          },
        }).then((instance) => {
          const exports = WebAssembly.Module.exports(moduleInstance);

          const index = parseInt(func);

          const funcName = exports[index].name;

          const funcToCall = instance.exports[funcName];

          if (args != null) {
            const ptr = alloc(instance.exports, args);

            const call = funcToCall.call(null, ptr, args.byteLength);

            const result = decompose(call);

            if (!result.status) {
              console.error(
                "Function call " + funcToCall.name.toString() + " failed!"
              );
            }

            const bytes = getAndFree(instance.exports, result);

            onSuccess(bytes);
            self.close();
          } else {
            onError("Invalid arguments");
          }
        });
      })
      .catch(onError);
  } else if (action === ACTIONS.RUN_FUNCTION) {
    const { func, params } = payload;

    Promise.resolve()
      .then(() => {
        // eslint-disable-next-line
        const fun = new Function(`return ${func}`)();
        onSuccess(
          fun({
            module: wasmModule,
            instance: moduleInstance,
            importObject,
            params,
          })
        );
      })
      .catch(onError);
  } else if (action === ACTIONS.SET_WASM_EXPORT) {
    const { exports } = payload;

    moduleInstance = exports;

    onSuccess();
  } else if (action === ACTIONS.CLOSE) {
    self.close();
  }
}
