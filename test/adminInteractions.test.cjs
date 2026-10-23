const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const {
  React,
  testing,
  loadAdmin,
  fixture,
  captureRefreshTimers,
} = require("./helpers/adminDom.cjs");
const { render, screen, fireEvent, waitFor, cleanup, act } = testing;
const { todayGuatemala } = require("../utils/reportDates.ts");
let restoreTimers;
afterEach(() => {
  cleanup();
  restoreTimers?.();
  restoreTimers = undefined;
});

async function mount(options = {}) {
  const setup = fixture();
  if (options.active) setup.state.operation = setup.makeOperation();
  restoreTimers = captureRefreshTimers(setup.state);
  const Admin = loadAdmin(setup.api);
  render(React.createElement(Admin));
  await screen.findByRole("button", { name: "BUS-FIXTURE" });
  await waitFor(() =>
    assert.ok(screen.queryByRole("tab", { name: "Resumen" })),
  );
  return setup;
}
const activationPosts = (state) =>
  state.calls.filter(
    (call) => call.path === "/operacion" && call.method === "POST",
  );

test("Web activation opens a visible confirmation and cancel never sends a POST", async () => {
  const { state } = await mount();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Iniciar periodo con tarifa Q5",
    }),
  );
  await screen.findByText("Iniciar periodo operativo");
  assert.equal(activationPosts(state).length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() =>
    assert.equal(screen.queryByRole("button", { name: "Confirmar" }), null),
  );
  assert.equal(activationPosts(state).length, 0);
});

test("confirmed activation is submitted once and displays success", async () => {
  const { state } = await mount();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Iniciar periodo con tarifa Q5",
    }),
  );
  const confirm = await screen.findByRole("button", { name: "Confirmar" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await screen.findByText("Periodo operativo iniciado con tarifa Q5.");
  assert.equal(activationPosts(state).length, 1);
  assert.equal(
    screen.queryByRole("button", { name: "Iniciar periodo con tarifa Q5" }),
    null,
  );
});

test("existing operation is refreshed without being created again", async () => {
  const { state, makeOperation } = await mount();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Iniciar periodo con tarifa Q5",
    }),
  );
  state.operation = makeOperation();
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
  await screen.findByText(/ya esta iniciado\. Se actualizo/);
  assert.equal(activationPosts(state).length, 0);
});

test("action errors remain visible after automatic refresh", async () => {
  const { state } = await mount();
  state.failActivation = true;
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Iniciar periodo con tarifa Q5",
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
  await screen.findByText("Fallo de activacion simulado");
  await act(async () => {
    for (const [timer, fn] of state.intervalCallbacks)
      if (timer.delay === 30000) fn();
  });
  assert.ok(screen.getByText("Fallo de activacion simulado"));
  fireEvent.click(screen.getByRole("button", { name: "Cerrar error" }));
  assert.equal(screen.queryByText("Fallo de activacion simulado"), null);
});

test("tabs select their views and request the matching data", async () => {
  const { state } = await mount();
  for (const [name, content, path] of [
    ["Eventos", "Eventos operativos", "/eventos?"],
    ["Historial previo", "Previo al periodo operativo", "/historial?"],
    ["Recorridos", "Nuevo recorrido", "/recorridos?"],
  ]) {
    const tab = screen.getByRole("tab", { name });
    fireEvent.click(tab);
    await screen.findByText(content);
    assert.equal(tab.getAttribute("aria-selected"), "true");
    await waitFor(() =>
      assert.ok(state.calls.some((call) => call.path.startsWith(path))),
    );
  }
  fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
  await screen.findByText("Reporte semanal");
  assert.ok(screen.getAllByText("Ingresos estimados").length > 0);
  assert.equal(screen.queryByText(/Pagos confirmados/), null);
});

test("real calendar dates and period selectors update statistics requests", async () => {
  const { state } = await mount();
  const today = todayGuatemala();
  const selected = today.slice(0, 8) + (today.endsWith("01") ? "02" : "01");
  fireEvent.click(await screen.findByTestId(`admin-calendar.day_${selected}`));
  await waitFor(() =>
    assert.ok(
      state.calls.some((call) =>
        call.path.includes(
          `/estadisticas?bus_id=1&periodo=semana&fecha=${selected}`,
        ),
      ),
    ),
  );
  await screen.findByText(new RegExp(`Fecha seleccionada: ${selected}`));
  for (const [label, period] of [
    ["Dia", "dia"],
    ["Mes", "mes"],
    ["Semana", "semana"],
  ]) {
    const option = screen.getByRole("radio", { name: label });
    fireEvent.click(option);
    await waitFor(() =>
      assert.ok(
        state.calls.some((call) =>
          call.path.includes(
            `/estadisticas?bus_id=1&periodo=${period}&fecha=${selected}`,
          ),
        ),
      ),
    );
    assert.equal(option.getAttribute("aria-checked"), "true");
  }
});

test("Today restores the calendar month after browsing without selecting another day", async () => {
  await mount();
  const title = await screen.findByTestId("admin-calendar.header.title");
  const currentMonth = title.textContent;
  fireEvent.click(screen.getByTestId("admin-calendar.header.rightArrow"));
  await waitFor(() => assert.notEqual(title.textContent, currentMonth));
  fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
  await waitFor(() =>
    assert.equal(
      screen.getByTestId("admin-calendar.header.title").textContent,
      currentMonth,
    ),
  );
});

test("trip start and confirmed finish show feedback and preserve cancellation", async () => {
  const { state } = await mount({ active: true });
  fireEvent.click(screen.getByRole("tab", { name: "Recorridos" }));
  const start = await screen.findByRole("button", {
    name: "Iniciar recorrido",
  });
  await waitFor(() =>
    assert.notEqual(start.getAttribute("aria-disabled"), "true"),
  );
  fireEvent.click(start);
  await screen.findByText("Recorrido iniciado.");
  const post = state.calls.find(
    (call) => call.path === "/recorridos" && call.method === "POST",
  );
  assert.deepEqual(post.body, {
    bus_id: "1",
    origen: "Terminal",
    destino: "Universidad",
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Finalizar recorrido" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
  assert.equal(
    state.calls.filter((call) => call.path.endsWith("/finalizar")).length,
    0,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Finalizar recorrido" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
  await screen.findByText("Recorrido finalizado.");
  assert.equal(
    state.calls.filter((call) => call.path.endsWith("/finalizar")).length,
    1,
  );
  await screen.findByText("Nuevo recorrido");
});

test("Web PDF save is enabled, uses the selected date and keeps native sharing disabled", async () => {
  const { api } = await mount({ active: true });
  const calls = [];
  api.downloadWeeklyPdf = async (...args) => {
    calls.push(args);
    return "Descarga del reporte iniciada";
  };
  const today = todayGuatemala();
  const selected = today.slice(0, 8) + (today.endsWith("01") ? "02" : "01");
  fireEvent.click(await screen.findByTestId(`admin-calendar.day_${selected}`));
  const save = await screen.findByRole("button", { name: "Guardar PDF" });
  await waitFor(() =>
    assert.notEqual(save.getAttribute("aria-disabled"), "true"),
  );
  assert.equal(
    screen
      .getByRole("button", { name: "Compartir PDF" })
      .getAttribute("aria-disabled"),
    "true",
  );
  assert.ok(screen.getByText("Compartir PDF no esta disponible en Web."));
  fireEvent.click(save);
  await screen.findByText("Descarga del reporte iniciada");
  assert.deepEqual(calls, [["1", selected]]);
});

test("Web PDF errors are visible without changing operational data", async () => {
  const { api, state } = await mount({ active: true });
  api.downloadWeeklyPdf = async () => {
    throw new Error("No se pudo generar el PDF de prueba");
  };
  fireEvent.click(await screen.findByRole("button", { name: "Guardar PDF" }));
  await screen.findByText("No se pudo generar el PDF de prueba");
  assert.equal(
    state.calls.some((call) => call.method !== "GET"),
    false,
  );
});
