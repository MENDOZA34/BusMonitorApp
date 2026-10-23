import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import {
  adminRequest,
  downloadWeeklyPdf,
  logout,
  restoreToken,
  saveToken,
  setSessionExpiredHandler,
} from "../services/adminService";
import type {
  Ajuste,
  BusAdmin,
  EventoAdmin,
  EventoHistorico,
  Id,
  Periodo,
  Recorrido,
  Resumen,
  Usuario,
} from "../types/admin";
import {
  fareCents,
  localDateTime,
  money,
  todayGuatemala,
} from "../utils/reportDates";

LocaleConfig.locales.es = {
  monthNames: [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ],
  monthNamesShort: [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ],
  dayNames: [
    "Domingo",
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sabado",
  ],
  dayNamesShort: ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
  today: "Hoy",
};
LocaleConfig.defaultLocale = "es";
type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Tab = "resumen" | "recorridos" | "eventos" | "historial";
type Confirmation = {
  title: string;
  description: string;
  action: () => Promise<unknown>;
  success?: string;
};
function Action({
  label,
  icon,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  icon: Icon;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={19} color={secondary ? "#185b4f" : "#fff"} />
      <Text style={[styles.actionText, secondary && { color: "#185b4f" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChangeText,
  password = false,
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  password?: boolean;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={password}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={numeric ? "decimal-pad" : "default"}
        maxLength={password ? 256 : 500}
      />
    </View>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.muted}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        numberOfLines={1}
        style={styles.metricValue}
      >
        {value}
      </Text>
    </View>
  );
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operacion";

export default function AdminScreen() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const [buses, setBuses] = useState<BusAdmin[]>([]);
  const [busId, setBusId] = useState("");
  const [busPicker, setBusPicker] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [fecha, setFecha] = useState(todayGuatemala);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [followToday, setFollowToday] = useState(true);
  const [tab, setTab] = useState<Tab>("resumen");
  const [summary, setSummary] = useState<Resumen | null>(null);
  const [trips, setTrips] = useState<Recorrido[]>([]);
  const [events, setEvents] = useState<EventoAdmin[]>([]);
  const [history, setHistory] = useState<EventoHistorico[]>([]);
  const [cursor, setCursor] = useState<Id | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [fare, setFare] = useState("");
  const [selected, setSelected] = useState<EventoAdmin | null>(null);
  const [reason, setReason] = useState("");
  const [adjustMode, setAdjustMode] = useState<"CONTEO" | "REASIGNACION">(
    "CONTEO",
  );
  const [targetTrip, setTargetTrip] = useState<Id | null>(null);
  const [audit, setAudit] = useState<Ajuste[]>([]);
  const version = useRef(0);
  const bus = buses.find((item) => String(item.id) === busId);
  const active = trips.find((trip) => !trip.finalizado_en);
  const params = `bus_id=${encodeURIComponent(busId)}&periodo=${periodo}&fecha=${fecha}`;

  useEffect(() => {
    let live = true;
    setSessionExpiredHandler(() => {
      version.current++;
      setUser(null);
      setSelected(null);
      setConfirmation(null);
      setSummary(null);
      setError("Sesion vencida. Inicie sesion nuevamente.");
    });
    (async () => {
      try {
        if (await restoreToken()) {
          const me = await adminRequest<{ usuario: Usuario }>("/auth/me");
          if (live) setUser(me.usuario);
        }
      } catch (e) {
        if (live) setError(message(e));
      } finally {
        if (live) setRestoring(false);
      }
    })();
    return () => {
      live = false;
      setSessionExpiredHandler();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!followToday) return;
      const update = () => setFecha(todayGuatemala());
      update();
      const timer = setInterval(update, 15000);
      return () => clearInterval(timer);
    }, [followToday]),
  );

  useEffect(() => {
    if (!user) return;
    let live = true;
    adminRequest<BusAdmin[]>("/buses")
      .then((rows) => {
        if (live) {
          setBuses(rows);
          setBusId((old) =>
            rows.some((row) => String(row.id) === old)
              ? old
              : String(rows[0]?.id ?? ""),
          );
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [user]);
  useEffect(() => {
    setOrigin(bus?.origen ?? "");
    setDestination(bus?.destino ?? "");
  }, [bus]);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    adminRequest<Ajuste[]>(`/ajustes/${selected.evento_id}`)
      .then((rows) => {
        if (live) setAudit(rows);
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [selected]);

  const load = useCallback(async () => {
    if (!user || !busId) return;
    const requestVersion = ++version.current;
    setLoading(true);
    try {
      const [data, routes, details] = await Promise.all([
        adminRequest<Resumen>(`/estadisticas?${params}`),
        adminRequest<Recorrido[]>(`/recorridos?bus_id=${busId}`),
        tab === "eventos"
          ? adminRequest<{ eventos: EventoAdmin[]; siguiente: Id | null }>(
              `/eventos?${params}`,
            )
          : tab === "historial"
            ? adminRequest<{
                eventos: EventoHistorico[];
                siguiente: Id | null;
              }>(`/historial?bus_id=${busId}`)
            : Promise.resolve(null),
      ]);
      if (version.current !== requestVersion) return;
      setSummary(data);
      setTrips(routes);
      setLoadError("");
      setCursor(details?.siguiente ?? null);
      if (tab === "eventos" && details)
        setEvents(details.eventos as EventoAdmin[]);
      if (tab === "historial" && details)
        setHistory(details.eventos as EventoHistorico[]);
    } catch (e) {
      if (version.current === requestVersion) setLoadError(message(e));
    } finally {
      if (version.current === requestVersion) setLoading(false);
    }
  }, [user, busId, params, tab]);
  const latestLoad = useRef(load);
  latestLoad.current = load;
  useFocusEffect(
    useCallback(() => {
      setSummary(null);
      setEvents([]);
      setHistory([]);
      setCursor(null);
      void load();
      const timer = setInterval(() => {
        void load();
      }, 30000);
      return () => {
        clearInterval(timer);
        version.current++;
      };
    }, [load]),
  );

  async function run(work: () => Promise<unknown>, success?: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      if (success) setNotice(success);
    } catch (e) {
      setError(message(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function mutate(path: string, body?: unknown) {
    await adminRequest(path, "POST", body);
    await latestLoad.current();
  }
  async function login() {
    const data = await adminRequest<{ token: string; usuario: Usuario }>(
      "/auth/login",
      "POST",
      { usuario: username, password },
    );
    await saveToken(data.token);
    setPassword("");
    setUser(data.usuario);
  }
  async function more() {
    const current = version.current;
    if (tab === "historial") {
      const data = await adminRequest<{
        eventos: EventoHistorico[];
        siguiente: Id | null;
      }>(`/historial?bus_id=${busId}&antes_de_id=${cursor}`);
      if (current === version.current) {
        setHistory((old) => [...old, ...data.eventos]);
        setCursor(data.siguiente);
      }
    } else {
      const data = await adminRequest<{
        eventos: EventoAdmin[];
        siguiente: Id | null;
      }>(`/eventos?${params}&antes_de_id=${cursor}`);
      if (current === version.current) {
        setEvents((old) => [...old, ...data.eventos]);
        setCursor(data.siguiente);
      }
    }
  }
  function confirm(
    title: string,
    action: () => Promise<unknown>,
    description: string,
    success?: string,
  ) {
    if (!busyRef.current)
      setConfirmation({ title, action, description, success });
  }
  async function activateOperation() {
    const current = await adminRequest<
      Pick<Resumen, "operacion" | "tarifa_centavos">
    >(`/operacion?bus_id=${busId}`);
    if (current.operacion) {
      setSummary((previous) =>
        previous && String(previous.bus.id) === busId
          ? { ...previous, ...current }
          : previous,
      );
      await latestLoad.current();
      setNotice(
        "El periodo operativo ya esta iniciado. Se actualizo su estado sin crearlo nuevamente.",
      );
      return;
    }
    const created = await adminRequest<
      NonNullable<Resumen["operacion"]> & { tarifa_centavos: number }
    >("/operacion", "POST", { bus_id: busId });
    setSummary((previous) =>
      previous && String(previous.bus.id) === busId
        ? {
            ...previous,
            operacion: created,
            tarifa_centavos: created.tarifa_centavos,
          }
        : previous,
    );
    await latestLoad.current();
    setNotice("Periodo operativo iniciado con tarifa Q5.");
  }

  if (restoring)
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#185b4f" />
        <Text>Validando sesion...</Text>
      </View>
    );
  if (!user)
    return (
      <ScrollView
        contentContainerStyle={styles.loginPage}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.login}>
          <Ionicons name="lock-closed-outline" color="#185b4f" size={34} />
          <Text style={styles.title}>Administracion</Text>
          <Field label="Usuario" value={username} onChangeText={setUsername} />
          <Field
            label="Contrasena"
            value={password}
            onChangeText={setPassword}
            password
          />
          {!!error && (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          )}
          <Action
            label={busy ? "Ingresando..." : "Iniciar sesion"}
            icon="log-in-outline"
            onPress={() => {
              void run(login);
            }}
            disabled={busy || !username.trim() || !password}
          />
        </View>
      </ScrollView>
    );

  return (
    <View style={styles.page}>
      <View style={styles.feedback}>
        {!!(error || loadError) && (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={styles.feedbackRow}
          >
            <Text style={[styles.error, styles.feedbackText]}>
              {error || loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar error"
              onPress={() => {
                setError("");
                setLoadError("");
              }}
              style={styles.dismiss}
            >
              <Ionicons name="close-outline" size={22} color="#a9233e" />
            </Pressable>
          </View>
        )}
        {!!notice && (
          <View accessibilityLiveRegion="polite" style={styles.feedbackRow}>
            <Text style={[styles.notice, styles.feedbackText]}>{notice}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar aviso"
              onPress={() => setNotice("")}
              style={styles.dismiss}
            >
              <Ionicons name="close-outline" size={22} color="#185b4f" />
            </Pressable>
          </View>
        )}
        {busy && (
          <View accessibilityLiveRegion="polite" style={styles.toolbar}>
            <ActivityIndicator color="#185b4f" />
            <Text style={styles.muted}>Procesando...</Text>
          </View>
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.toolbar}>
          <View style={styles.grow}>
            <Text style={styles.title}>Administracion</Text>
            <Text style={styles.muted}>{user.usuario}</Text>
          </View>
          <Action
            label="Cerrar sesion"
            icon="log-out-outline"
            secondary
            disabled={busy}
            onPress={() => {
              void run(async () => {
                try {
                  await logout();
                } finally {
                  version.current++;
                  setUser(null);
                  setSummary(null);
                  setSelected(null);
                }
              });
            }}
          />
        </View>
        <View style={styles.toolbar}>
          <Action
            label={bus?.codigo_bus ?? "Seleccionar bus"}
            icon="bus-outline"
            secondary
            onPress={() => setBusPicker(true)}
            disabled={busy}
          />
          <Action
            label="Actualizar"
            icon="refresh-outline"
            secondary
            onPress={() => {
              if (busId) void load();
              else
                void run(async () => {
                  const rows = await adminRequest<BusAdmin[]>("/buses");
                  setBuses(rows);
                  setBusId(String(rows[0]?.id ?? ""));
                });
            }}
            disabled={busy || loading}
          />
          {loading && <ActivityIndicator color="#185b4f" />}
        </View>
        {!buses.length && (
          <Text style={styles.empty}>No hay buses disponibles.</Text>
        )}
        {!!busId && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabs}
            >
              {(
                [
                  ["resumen", "Resumen", "stats-chart-outline"],
                  ["recorridos", "Recorridos", "navigate-outline"],
                  ["eventos", "Eventos", "swap-vertical-outline"],
                  ["historial", "Historial previo", "archive-outline"],
                ] as const
              ).map(([value, label, icon]) => (
                <Pressable
                  accessibilityRole="tab"
                  aria-selected={tab === value}
                  accessibilityState={{ selected: tab === value }}
                  key={value}
                  onPress={() => setTab(value)}
                  style={[styles.tab, tab === value && styles.tabSelected]}
                >
                  <Ionicons
                    name={icon}
                    size={18}
                    color={tab === value ? "#185b4f" : "#59656a"}
                  />
                  <Text
                    style={
                      tab === value ? styles.tabTextSelected : styles.muted
                    }
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {summary && !summary.operacion && (
              <View style={styles.band}>
                <Text style={styles.heading}>
                  Periodo operativo sin iniciar
                </Text>
                <Action
                  label="Iniciar periodo con tarifa Q5"
                  icon="play-circle-outline"
                  disabled={busy}
                  onPress={() =>
                    confirm(
                      "Iniciar periodo operativo",
                      activateOperation,
                      `Se iniciara el periodo de ${bus?.codigo_bus} con tarifa Q5 por entrada. Los registros anteriores quedaran en el historial previo.`,
                    )
                  }
                />
              </View>
            )}

            {(tab === "resumen" || tab === "eventos") && (
              <View style={styles.band}>
                <View style={styles.segment}>
                  {(
                    [
                      ["dia", "Dia"],
                      ["semana", "Semana"],
                      ["mes", "Mes"],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      accessibilityRole="radio"
                      aria-checked={periodo === value}
                      accessibilityState={{ checked: periodo === value }}
                      key={value}
                      style={[
                        styles.segmentItem,
                        periodo === value && styles.segmentSelected,
                      ]}
                      onPress={() => setPeriodo(value)}
                    >
                      <Text
                        style={
                          periodo === value
                            ? styles.segmentTextSelected
                            : styles.muted
                        }
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Calendar
                  testID="admin-calendar"
                  firstDay={1}
                  key={calendarRevision}
                  initialDate={fecha}
                  onDayPress={(day) => {
                    setFollowToday(false);
                    setFecha(day.dateString);
                  }}
                  markedDates={Object.fromEntries(
                    (summary?.dias.map((day) => day.fecha) ?? [fecha]).map(
                      (date, index, array) => [
                        date,
                        {
                          startingDay: index === 0,
                          endingDay: index === array.length - 1,
                          color: date === fecha ? "#185b4f" : "#d6ece6",
                          textColor: date === fecha ? "#ffffff" : "#144b40",
                        },
                      ],
                    ),
                  )}
                  markingType="period"
                  theme={{
                    todayTextColor: "#a83243",
                    arrowColor: "#185b4f",
                    textDayFontSize: 15,
                  }}
                />
                <View style={styles.toolbar}>
                  <Text style={styles.muted}>
                    Fecha seleccionada: {fecha}
                    {"\n"}
                    {summary ? `${summary.desde} al ${summary.hasta}` : fecha} ·
                    America/Guatemala
                  </Text>
                  <Action
                    label="Hoy"
                    icon="calendar-outline"
                    secondary
                    onPress={() => {
                      setFollowToday(true);
                      setFecha(todayGuatemala());
                      setCalendarRevision((value) => value + 1);
                    }}
                  />
                </View>
              </View>
            )}

            {tab === "resumen" && summary && (
              <>
                <View style={styles.metrics}>
                  <Metric label="Entradas" value={summary.totales.entradas} />
                  <Metric label="Salidas" value={summary.totales.salidas} />
                  <Metric
                    label="Ingresos estimados"
                    value={money(summary.totales.ingresos_centavos)}
                  />
                  <Metric
                    label="Sin recorrido"
                    value={summary.totales.sin_recorrido}
                  />
                </View>
                <ScrollView horizontal style={styles.tableScroll}>
                  <View style={styles.table}>
                    <View style={styles.tableRow}>
                      {[
                        "Fecha",
                        "Entradas",
                        "Salidas",
                        "Ingresos estimados",
                      ].map((label) => (
                        <Text key={label} style={[styles.cell, styles.strong]}>
                          {label}
                        </Text>
                      ))}
                    </View>
                    {summary.dias.map((day) => (
                      <View style={styles.tableRow} key={day.fecha}>
                        <Text style={styles.cell}>{day.fecha}</Text>
                        <Text style={styles.cell}>{day.entradas}</Text>
                        <Text style={styles.cell}>{day.salidas}</Text>
                        <Text style={styles.cell}>
                          {money(day.ingresos_centavos)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <Text style={styles.muted}>
                  Originales: {summary.totales.entradas_originales} entradas,{" "}
                  {summary.totales.salidas_originales} salidas
                </Text>
                <Text style={styles.muted}>
                  Ajustes: {summary.totales.ajuste_entradas} entradas,{" "}
                  {summary.totales.ajuste_salidas} salidas
                </Text>
                <View style={styles.band}>
                  <Text style={styles.heading}>Reporte semanal</Text>
                  <View style={styles.toolbar}>
                    <Action
                      label="Guardar PDF"
                      icon="download-outline"
                      disabled={
                        busy ||
                        (Platform.OS !== "android" && Platform.OS !== "web")
                      }
                      onPress={() => {
                        void run(async () =>
                          setNotice(await downloadWeeklyPdf(busId, fecha)),
                        );
                      }}
                    />
                    <Action
                      label="Compartir PDF"
                      icon="share-outline"
                      secondary
                      disabled={busy || Platform.OS !== "android"}
                      onPress={() => {
                        void run(async () =>
                          setNotice(
                            await downloadWeeklyPdf(busId, fecha, true),
                          ),
                        );
                      }}
                    />
                  </View>
                  {Platform.OS === "web" && (
                    <Text style={styles.muted}>
                      Compartir PDF no esta disponible en Web.
                    </Text>
                  )}
                </View>
                <View style={styles.band}>
                  <Text style={styles.heading}>
                    Tarifa vigente:{" "}
                    {summary.tarifa_centavos == null
                      ? "Sin iniciar"
                      : money(summary.tarifa_centavos)}
                  </Text>
                  <Field
                    label="Nueva tarifa (Q)"
                    value={fare}
                    onChangeText={setFare}
                    numeric
                  />
                  <Action
                    label="Guardar tarifa"
                    icon="save-outline"
                    disabled={busy || !fare || !summary.operacion}
                    onPress={() => {
                      void run(async () => {
                        await mutate("/tarifas", {
                          bus_id: busId,
                          tarifa_centavos: fareCents(fare),
                        });
                        setFare("");
                      }, "Tarifa actualizada");
                    }}
                  />
                </View>
              </>
            )}

            {tab === "recorridos" && (
              <View style={styles.band}>
                <Text style={styles.heading}>
                  {active ? "Recorrido en curso" : "Nuevo recorrido"}
                </Text>
                {active ? (
                  <View style={styles.trip}>
                    <Text style={styles.strong}>
                      #{active.id} · {active.origen} → {active.destino}
                    </Text>
                    <Text>{localDateTime(active.iniciado_en)}</Text>
                    <Text>
                      {active.entradas} entradas · {active.salidas} salidas ·{" "}
                      Ingresos estimados: {money(active.ingresos_centavos)}
                    </Text>
                    <Action
                      label="Finalizar recorrido"
                      icon="stop-circle-outline"
                      disabled={busy}
                      onPress={() =>
                        confirm(
                          "Finalizar recorrido",
                          () => mutate(`/recorridos/${active.id}/finalizar`),
                          `Se finalizara el recorrido #${active.id} de ${active.origen} a ${active.destino}.`,
                          "Recorrido finalizado.",
                        )
                      }
                    />
                  </View>
                ) : (
                  <>
                    <Field
                      label="Origen"
                      value={origin}
                      onChangeText={setOrigin}
                    />
                    <Action
                      label="Intercambiar origen y destino"
                      icon="swap-vertical-outline"
                      secondary
                      onPress={() => {
                        setOrigin(destination);
                        setDestination(origin);
                      }}
                    />
                    <Field
                      label="Destino"
                      value={destination}
                      onChangeText={setDestination}
                    />
                    <Action
                      label="Iniciar recorrido"
                      icon="play-outline"
                      disabled={
                        busy ||
                        !origin.trim() ||
                        !destination.trim() ||
                        !summary?.operacion
                      }
                      onPress={() => {
                        void run(
                          () =>
                            mutate("/recorridos", {
                              bus_id: busId,
                              origen: origin,
                              destino: destination,
                            }),
                          "Recorrido iniciado.",
                        );
                      }}
                    />
                  </>
                )}
                <Text style={styles.heading}>Ultimos recorridos</Text>
                {!trips.length && (
                  <Text style={styles.empty}>Sin recorridos registrados.</Text>
                )}
                {trips
                  .filter((trip) => !!trip.finalizado_en)
                  .map((trip) => (
                    <View style={styles.trip} key={trip.id}>
                      <Text style={styles.strong}>
                        #{trip.id} · {trip.origen} → {trip.destino}
                      </Text>
                      <Text style={styles.muted}>
                        {localDateTime(trip.iniciado_en)} al{" "}
                        {localDateTime(trip.finalizado_en!)}
                      </Text>
                      <Text>
                        {trip.entradas} entradas · {trip.salidas} salidas
                      </Text>
                      <Text>
                        Ingresos estimados: {money(trip.ingresos_centavos)}
                      </Text>
                    </View>
                  ))}
              </View>
            )}

            {tab === "eventos" && (
              <View style={styles.band}>
                <Text style={styles.heading}>Eventos operativos</Text>
                {!events.length && !loading && (
                  <Text style={styles.empty}>Sin eventos en el periodo.</Text>
                )}
                {events.map((event) => (
                  <View style={styles.event} key={event.evento_id}>
                    <View style={styles.grow}>
                      <Text style={styles.strong}>
                        #{event.evento_id} · {event.tipo_evento}
                      </Text>
                      <Text>{localDateTime(event.recibido_en)}</Text>
                      <Text style={styles.muted}>
                        {event.recorrido_efectivo == null
                          ? "Sin recorrido"
                          : `Recorrido #${event.recorrido_efectivo}`}{" "}
                        · Ajuste: {event.delta}
                      </Text>
                    </View>
                    <Action
                      label="Revisar"
                      icon="create-outline"
                      secondary
                      disabled={busy}
                      onPress={() => {
                        setSelected(event);
                        setReason("");
                        setAudit([]);
                        setTargetTrip(event.recorrido_efectivo);
                        setAdjustMode("CONTEO");
                      }}
                    />
                  </View>
                ))}
                {cursor && (
                  <Action
                    label="Cargar anteriores"
                    icon="chevron-down-outline"
                    secondary
                    disabled={busy || loading}
                    onPress={() => {
                      void run(more);
                    }}
                  />
                )}
              </View>
            )}

            {tab === "historial" && (
              <View style={styles.band}>
                <Text style={styles.heading}>Previo al periodo operativo</Text>
                <Text style={styles.muted}>
                  Ingresos estimados: No calculados
                </Text>
                {!history.length && !loading && (
                  <Text style={styles.empty}>Sin registros anteriores.</Text>
                )}
                {history.map((event) => (
                  <View style={styles.historyRow} key={event.id}>
                    <Text style={styles.strong}>
                      #{event.id} · {event.tipo_evento}
                    </Text>
                    <Text style={styles.muted}>
                      {event.fecha_hora} · Ocupacion: {event.cantidad_actual}
                    </Text>
                  </View>
                ))}
                {cursor && (
                  <Action
                    label="Cargar anteriores"
                    icon="chevron-down-outline"
                    secondary
                    disabled={busy || loading}
                    onPress={() => {
                      void run(more);
                    }}
                  />
                )}
              </View>
            )}
            <Text style={styles.warning}>
              Sin deduplicacion garantizada: firmware pendiente de verificar.
            </Text>
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!confirmation}
        transparent
        animationType={Platform.OS === "web" ? "none" : "fade"}
        onRequestClose={() => setConfirmation(null)}
      >
        <View style={styles.scrim}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.heading}>{confirmation?.title}</Text>
            <Text style={styles.strong}>{confirmation?.description}</Text>
            <View style={styles.confirmActions}>
              <Action
                label="Cancelar"
                icon="close-outline"
                secondary
                onPress={() => setConfirmation(null)}
              />
              <Action
                label="Confirmar"
                icon="checkmark-outline"
                disabled={busy}
                onPress={() => {
                  if (!confirmation || busyRef.current) return;
                  const pending = confirmation;
                  setConfirmation(null);
                  void run(pending.action, pending.success);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={busPicker}
        transparent
        animationType={Platform.OS === "web" ? "none" : "fade"}
        onRequestClose={() => setBusPicker(false)}
      >
        <View style={styles.scrim}>
          <View style={styles.dialog}>
            <Text style={styles.heading}>Seleccionar bus</Text>
            <ScrollView>
              {buses.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.choice}
                  onPress={() => {
                    setBusId(String(item.id));
                    setBusPicker(false);
                  }}
                >
                  <Ionicons
                    name={
                      String(item.id) === busId
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={20}
                    color="#185b4f"
                  />
                  <Text>{item.codigo_bus}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Action
              label="Cerrar"
              icon="close-outline"
              secondary
              onPress={() => setBusPicker(false)}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!selected}
        transparent
        animationType={Platform.OS === "web" ? "none" : "slide"}
        onRequestClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <View style={styles.scrim}>
          <ScrollView
            style={styles.dialog}
            contentContainerStyle={styles.dialogContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.heading}>
              Evento #{selected?.evento_id} · {selected?.tipo_evento}
            </Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.segment}>
              {(["CONTEO", "REASIGNACION"] as const).map((value) => (
                <Pressable
                  key={value}
                  style={[
                    styles.segmentItem,
                    adjustMode === value && styles.segmentSelected,
                  ]}
                  onPress={() => setAdjustMode(value)}
                >
                  <Text
                    style={
                      adjustMode === value
                        ? styles.segmentTextSelected
                        : styles.muted
                    }
                  >
                    {value === "CONTEO" ? "Conteo" : "Recorrido"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {adjustMode === "REASIGNACION" && (
              <View>
                {[
                  { id: null, origen: "Sin recorrido", destino: "" },
                  ...trips,
                ].map((trip) => (
                  <Pressable
                    style={styles.choice}
                    key={trip.id ?? "none"}
                    onPress={() => setTargetTrip(trip.id)}
                  >
                    <Ionicons
                      name={
                        trip.id === targetTrip
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color="#185b4f"
                    />
                    <Text style={styles.grow}>
                      {trip.id == null
                        ? "Sin recorrido"
                        : `#${trip.id} ${trip.origen} → ${trip.destino}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Field
              label="Motivo del ajuste"
              value={reason}
              onChangeText={setReason}
            />
            <Action
              label={
                adjustMode === "REASIGNACION"
                  ? "Guardar asignacion"
                  : Number(selected?.delta) < 0
                    ? "Restaurar evento"
                    : "Descontar evento"
              }
              icon="save-outline"
              disabled={
                busy ||
                !reason.trim() ||
                (adjustMode === "CONTEO" &&
                  !["ENTRO", "SALIO"].includes(selected?.tipo_evento ?? ""))
              }
              onPress={() => {
                void run(async () => {
                  await mutate("/ajustes", {
                    evento_id: selected?.evento_id,
                    tipo: adjustMode,
                    motivo: reason,
                    ...(adjustMode === "CONTEO"
                      ? { delta: Number(selected?.delta) < 0 ? 1 : -1 }
                      : { recorrido_id: targetTrip }),
                  });
                  setSelected(null);
                }, "Ajuste registrado");
              }}
            />
            <Text style={styles.heading}>Auditoria</Text>
            {!audit.length && (
              <Text style={styles.muted}>Sin ajustes anteriores.</Text>
            )}
            {audit.map((item) => (
              <View style={styles.historyRow} key={item.id}>
                <Text style={styles.strong}>
                  {item.usuario} · {item.tipo}{" "}
                  {item.delta ??
                    (item.recorrido_id == null
                      ? "Sin recorrido"
                      : `#${item.recorrido_id}`)}
                </Text>
                <Text>{item.motivo}</Text>
                <Text style={styles.muted}>
                  {localDateTime(item.creado_en)}
                </Text>
              </View>
            ))}
            <Action
              label="Cerrar"
              icon="close-outline"
              secondary
              disabled={busy}
              onPress={() => setSelected(null)}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f6f8f8" },
  feedback: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    paddingHorizontal: 18,
    gap: 8,
  },
  feedbackRow: { flexDirection: "row", alignItems: "center", paddingTop: 8 },
  feedbackText: { flex: 1 },
  dismiss: { padding: 10 },
  confirmActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  content: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 42,
    gap: 14,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loginPage: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f6f8f8",
  },
  login: { width: "100%", maxWidth: 420, gap: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#173b35" },
  heading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#173b35",
    marginVertical: 10,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  grow: { flex: 1, minWidth: 120 },
  muted: { color: "#59656a", fontSize: 13, lineHeight: 20 },
  strong: { fontWeight: "700", color: "#263a3d", lineHeight: 22 },
  action: {
    minHeight: 44,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#185b4f",
    borderRadius: 6,
  },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 14, flexShrink: 1 },
  secondary: { backgroundColor: "#e5efec" },
  disabled: { opacity: 0.45 },
  field: { gap: 6, marginVertical: 6 },
  label: { color: "#33494a", fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#adbdbb",
    borderRadius: 6,
    backgroundColor: "#fff",
    padding: 12,
    fontSize: 16,
    color: "#162f30",
  },
  error: {
    color: "#a9233e",
    backgroundColor: "#fbecef",
    padding: 12,
    borderRadius: 6,
    lineHeight: 21,
  },
  notice: {
    color: "#185b4f",
    backgroundColor: "#dcefe5",
    padding: 12,
    borderRadius: 6,
  },
  warning: { color: "#81540b", fontSize: 12, lineHeight: 18, marginTop: 12 },
  tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: "#cdd8d7" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 12,
    minHeight: 46,
    borderBottomWidth: 3,
    borderColor: "transparent",
  },
  tabSelected: { borderColor: "#185b4f" },
  tabTextSelected: { color: "#185b4f", fontWeight: "700" },
  band: {
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#dbe3e2",
  },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#b9cdca",
    borderRadius: 6,
    overflow: "hidden",
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  segmentSelected: { backgroundColor: "#185b4f" },
  segmentTextSelected: { color: "#fff", fontWeight: "600" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    width: "47%",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: "#cbdbd7",
  },
  metricValue: {
    color: "#173b35",
    fontSize: 25,
    fontWeight: "700",
    marginTop: 5,
  },
  tableScroll: { flexGrow: 0 },
  table: { minWidth: 500, flex: 1 },
  tableRow: {
    flexDirection: "row",
    minHeight: 42,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#dce3e2",
  },
  cell: { width: 125, padding: 8, color: "#304547" },
  trip: {
    borderWidth: 1,
    borderColor: "#cbd8d5",
    borderRadius: 6,
    padding: 14,
    backgroundColor: "#fff",
    gap: 8,
  },
  event: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#dce3e2",
  },
  historyRow: {
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#dce3e2",
  },
  empty: { paddingVertical: 20, color: "#59656a" },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(15,30,29,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  dialog: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 18,
  },
  dialogContent: { gap: 12, paddingBottom: 36 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
  },
});
