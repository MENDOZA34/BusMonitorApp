const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

// Load the real service with browser/native adapters, never .env or a live API.
function serviceFixture(
  platform = "web",
  response = () =>
    new Response("%PDF-1.7\nfixture", {
      headers: { "Content-Type": "application/pdf" },
    }),
  sharingAvailable = true,
) {
  const dom = new JSDOM("<!doctype html><body></body>");
  const calls = {
    requests: [],
    links: [],
    blobs: [],
    revoked: [],
    native: [],
    timers: [],
  };
  dom.window.HTMLAnchorElement.prototype.click = function () {
    calls.links.push({
      href: this.href,
      download: this.download,
      attached: this.isConnected,
    });
  };
  const fileSystem = {
    cacheDirectory: "file:///cache/",
    EncodingType: { Base64: "base64" },
    async downloadAsync(...args) {
      calls.native.push(["download", ...args]);
      return { status: 200 };
    },
    async readAsStringAsync(...args) {
      calls.native.push(["read", ...args]);
      return "JVBERg==";
    },
    async writeAsStringAsync(...args) {
      calls.native.push(["write", ...args]);
    },
    async deleteAsync(...args) {
      calls.native.push(["cleanup", ...args]);
    },
    StorageAccessFramework: {
      async requestDirectoryPermissionsAsync() {
        calls.native.push(["permission"]);
        return { granted: true, directoryUri: "chosen/" };
      },
      async createFileAsync(...args) {
        calls.native.push(["create", ...args]);
        return "chosen/report.pdf";
      },
    },
  };
  const dependencies = {
    "react-native": { Platform: { OS: platform } },
    "./apiConfig": { BASE_URL: "http://backend.invalid" },
    "expo-secure-store": {
      async setItemAsync() {},
      async deleteItemAsync() {},
    },
    "expo-file-system/legacy": fileSystem,
    "expo-sharing": {
      async isAvailableAsync() {
        return sharingAvailable;
      },
      async shareAsync(...args) {
        calls.native.push(["share", ...args]);
      },
    },
  };
  const filename = resolve(__dirname, "../services/adminService.ts");
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      AbortController,
      document: dom.window.document,
      URL: {
        createObjectURL(blob) {
          calls.blobs.push(blob);
          return "blob:fixture";
        },
        revokeObjectURL(url) {
          calls.revoked.push(url);
        },
      },
      setTimeout(fn, delay) {
        if (delay === 60000) {
          calls.timers.push(fn);
          return 0;
        }
        return setTimeout(fn, delay);
      },
      clearTimeout,
      async fetch(...args) {
        calls.requests.push(args);
        return response();
      },
      require(name) {
        assert.ok(
          Object.hasOwn(dependencies, name),
          "Unexpected service dependency",
        );
        return dependencies[name];
      },
    },
    { filename },
  );
  return { api: module.exports, calls, document: dom.window.document };
}

test("Web downloads an authenticated PDF blob, encodes parameters and releases the URL", async () => {
  const { api, calls, document } = serviceFixture();
  const session = "isolated-pdf-fixture";
  await api.saveToken(session);
  assert.equal(
    await api.downloadWeeklyPdf("1&extra=2", "2026-10-23"),
    "Descarga del reporte iniciada",
  );
  assert.equal(calls.requests.length, 1);
  const [url, options] = calls.requests[0];
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/api/admin/reportes/semanal.pdf");
  assert.equal(parsed.searchParams.get("bus_id"), "1&extra=2");
  assert.equal(parsed.searchParams.get("fecha"), "2026-10-23");
  assert.equal(parsed.searchParams.has("extra"), false);
  assert.equal(url.includes(session), false);
  assert.ok(
    options.headers.Authorization === `Bearer ${session}`,
    "Session must be sent only in the header",
  );
  assert.equal(options.cache, "no-store");
  assert.match(await calls.blobs[0].text(), /^%PDF-/);
  assert.deepEqual(calls.links, [
    {
      href: "blob:fixture",
      download: "BusMonitor_1&extra=2_2026-10-23.pdf",
      attached: true,
    },
  ]);
  assert.equal(document.querySelector("a"), null);
  assert.deepEqual(calls.native, []);
  assert.deepEqual(calls.revoked, []);
  calls.timers[0]();
  assert.deepEqual(calls.revoked, ["blob:fixture"]);
});

test("Web cannot download without a session or invoke Android sharing", async () => {
  const { api, calls } = serviceFixture();
  await assert.rejects(
    api.downloadWeeklyPdf("1", "2026-10-23"),
    (error) => error.status === 401,
  );
  await api.saveToken("isolated-pdf-fixture");
  await assert.rejects(
    api.downloadWeeklyPdf("1", "2026-10-23", true),
    /Android/,
  );
  assert.equal(calls.requests.length, 0);
  assert.deepEqual(calls.native, []);
});

for (const status of [401, 500]) {
  test(`Web PDF HTTP ${status} is reported without downloading an error document`, async () => {
    const { api, calls } = serviceFixture("web", () =>
      Response.json({ error: "PDF fixture error" }, { status }),
    );
    let expired = 0;
    api.setSessionExpiredHandler(() => expired++);
    await api.saveToken("isolated-pdf-fixture");
    await assert.rejects(
      api.downloadWeeklyPdf("1", "2026-10-23"),
      (error) =>
        error.status === status && error.message === "PDF fixture error",
    );
    assert.equal(expired, status === 401 ? 1 : 0);
    assert.equal((await api.restoreToken()) === null, status === 401);
    assert.deepEqual(calls.links, []);
    assert.deepEqual(calls.blobs, []);
  });
}

test("Web rejects non-PDF content even if HTTP status is successful", async () => {
  const { api, calls } = serviceFixture("web", () =>
    Response.json({ error: "not a PDF" }),
  );
  await api.saveToken("isolated-pdf-fixture");
  await assert.rejects(api.downloadWeeklyPdf("1", "2026-10-23"), /PDF valido/);
  assert.deepEqual(calls.links, []);
});

test("Web network errors do not start a download", async () => {
  const { api, calls } = serviceFixture("web", () => {
    throw new Error("Offline fixture");
  });
  await api.saveToken("isolated-pdf-fixture");
  await assert.rejects(
    api.downloadWeeklyPdf("1", "2026-10-23"),
    /Offline fixture/,
  );
  assert.deepEqual(calls.links, []);
});

for (const share of [false, true]) {
  test(`Android PDF ${share ? "sharing" : "saving"} keeps its native flow and cache cleanup`, async () => {
    const { api, calls } = serviceFixture("android");
    await api.saveToken("isolated-pdf-fixture");
    assert.equal(
      await api.downloadWeeklyPdf("1", "2026-10-23", share),
      share ? "Reporte compartido" : "Reporte guardado",
    );
    assert.equal(calls.requests.length, 0);
    assert.deepEqual(calls.links, []);
    assert.deepEqual(
      calls.native.map(([name]) => name),
      share
        ? ["download", "share", "cleanup"]
        : ["download", "permission", "read", "create", "write", "cleanup"],
    );
    assert.equal(
      calls.native[0][1],
      "http://backend.invalid/api/admin/reportes/semanal.pdf?bus_id=1&fecha=2026-10-23",
    );
    assert.ok(
      calls.native[0][3].headers.Authorization ===
        "Bearer isolated-pdf-fixture",
      "Native download retains header authentication",
    );
    if (share) {
      const [, uri, options] = calls.native.find(([name]) => name === "share");
      assert.equal(uri, "file:///cache/BusMonitor_1_2026-10-23.pdf");
      assert.equal(options.mimeType, "application/pdf");
      assert.equal(options.dialogTitle, "Reporte semanal");
    }
  });
}

test("Android reports unavailable native sharing without invoking the chooser", async () => {
  const { api, calls } = serviceFixture("android", undefined, false);
  await api.saveToken("isolated-pdf-fixture");
  await assert.rejects(
    api.downloadWeeklyPdf("1", "2026-10-23", true),
    /No hay una aplicacion disponible para compartir/,
  );
  assert.deepEqual(
    calls.native.map(([name]) => name),
    ["download", "cleanup"],
  );
});
