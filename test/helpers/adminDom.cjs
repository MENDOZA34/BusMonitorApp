const { JSDOM } = require("jsdom");
const { readFileSync, existsSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const ts = require("typescript");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
for (const key of [
  "HTMLElement",
  "Element",
  "Node",
  "ShadowRoot",
  "MutationObserver",
])
  global[key] = dom.window[key];
for (const key of [
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
])
  global[key] = dom.window[key].bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require("react");
const native = require("react-native-web");
const testing = require("@testing-library/react");
const root = resolve(__dirname, "../..");

// Run the actual screen, Web controls and calendar with a local API fixture.
// Nothing here loads .env, fetches the backend or creates database records.
function loadAdmin(api) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = createRequire(filename);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    const dependencies = (name) => {
      if (name === "react-native") return native;
      if (name === "expo-router")
        return {
          useFocusEffect: (effect) => React.useEffect(effect, [effect]),
        };
      if (name === "@expo/vector-icons")
        return {
          Ionicons: () => React.createElement("span", { "aria-hidden": true }),
        };
      if (name.endsWith("/services/adminService")) return api;
      if (name === "react-native-calendars")
        return {
          Calendar: load(
            resolve(
              root,
              "node_modules/react-native-calendars/src/calendar/index.js",
            ),
          ).default,
          LocaleConfig: require("xdate"),
        };
      if (/\.(png|jpg)$/.test(name))
        return { uri: "data:image/png;base64,", width: 16, height: 16 };
      const typedFile = name.startsWith(".")
        ? [
            resolve(dirname(filename), name + ".ts"),
            resolve(dirname(filename), name + ".tsx"),
          ].find(existsSync)
        : undefined;
      const file = typedFile || localRequire.resolve(name);
      if (
        file.includes("react-native-calendars") ||
        file.includes("react-native-swipe-gestures") ||
        (file.startsWith(root) &&
          /\.tsx?$/.test(file) &&
          !file.includes("node_modules"))
      )
        return load(file);
      return localRequire(name);
    };
    const run = vm.runInThisContext(
      `(function(require,module,exports){${code}\n})`,
      { filename },
    );
    run(dependencies, module, module.exports);
    return module.exports;
  }
  return load(resolve(root, "app/admin.tsx")).default;
}

function fixture() {
  const state = {
    operation: null,
    trips: [],
    calls: [],
    failActivation: false,
    intervalCallbacks: new Map(),
  };
  const totals = {
    entradas_originales: 0,
    salidas_originales: 0,
    ajuste_entradas: 0,
    ajuste_salidas: 0,
    entradas: 0,
    salidas: 0,
    ingresos_centavos: 0,
    sin_recorrido: 0,
  };
  const makeOperation = () => ({
    bus_id: 1,
    iniciado_en: "2026-10-23 12:00:00.000",
    corte_evento_id: "17",
  });
  const api = {
    restoreToken: async () => "isolated-test-session",
    saveToken: async () => {},
    logout: async () => {},
    setSessionExpiredHandler() {},
    downloadWeeklyPdf: async () => "No native file operation in DOM tests",
    async adminRequest(path, method = "GET", body) {
      state.calls.push({ path, method, body });
      const url = new URL(path, "http://isolated.invalid");
      if (path === "/auth/me")
        return { usuario: { id: 1, usuario: "admin-fixture" } };
      if (path === "/buses")
        return [
          {
            id: 1,
            codigo_bus: "BUS-FIXTURE",
            origen: "Terminal",
            destino: "Universidad",
            capacidad: 30,
          },
        ];
      if (url.pathname === "/estadisticas") {
        const fecha = url.searchParams.get("fecha");
        return {
          bus: { id: 1, codigo_bus: "BUS-FIXTURE" },
          operacion: state.operation,
          tarifa_centavos: state.operation ? 500 : null,
          periodo: url.searchParams.get("periodo"),
          fecha,
          desde: fecha,
          hasta: fecha,
          dias: [{ fecha, ...totals }],
          totales: totals,
        };
      }
      if (url.pathname === "/operacion") {
        if (method === "POST") {
          if (state.failActivation)
            throw new Error("Fallo de activacion simulado");
          state.operation = makeOperation();
          return { ...state.operation, tarifa_centavos: 500 };
        }
        return {
          operacion: state.operation,
          tarifa_centavos: state.operation ? 500 : null,
        };
      }
      if (url.pathname === "/recorridos") {
        if (method === "POST") {
          state.trips = [
            {
              ...body,
              id: "1",
              iniciado_en: "2026-10-23 12:01:00.000",
              finalizado_en: null,
              entradas: 0,
              salidas: 0,
              ingresos_centavos: 0,
            },
          ];
          return state.trips[0];
        }
        return state.trips;
      }
      if (url.pathname === "/recorridos/1/finalizar") {
        state.trips[0].finalizado_en = "2026-10-23 13:00:00.000";
        return state.trips[0];
      }
      if (["/eventos", "/historial"].includes(url.pathname))
        return { eventos: [], siguiente: null };
      throw new Error("Unexpected request in isolated UI test");
    },
  };
  return { state, api, makeOperation };
}

function captureRefreshTimers(state) {
  const originalSet = global.setInterval;
  const originalClear = global.clearInterval;
  global.setInterval = (fn, delay, ...args) => {
    if (![15000, 30000].includes(delay)) return originalSet(fn, delay, ...args);
    const timer = { delay };
    state.intervalCallbacks.set(timer, fn);
    return timer;
  };
  global.clearInterval = (timer) => {
    if (state.intervalCallbacks.has(timer))
      state.intervalCallbacks.delete(timer);
    else originalClear(timer);
  };
  return () => {
    global.setInterval = originalSet;
    global.clearInterval = originalClear;
  };
}

module.exports = { React, testing, loadAdmin, fixture, captureRefreshTimers };
