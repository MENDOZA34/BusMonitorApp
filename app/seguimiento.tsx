import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const BASE_URL = "https://bus-api-production.up.railway.app";

type BusEstado = {
  bus_id: number;
  codigo_bus: string;
  placa: string;
  capacidad: number;
  ruta: string;
  origen: string;
  destino: string;
  cantidad: number;
  estado: string;
  latitud: string | number;
  longitud: string | number;
  velocidad: string | number;
  fecha_hora: string;
  entradas_detectadas?: number;
  salidas_detectadas?: number;
};

type Parada = {
  id: number;
  ruta_id: number;
  nombre: string;
  latitud: string | number;
  longitud: string | number;
  orden_ruta: number;
};

type RutaResponse = {
  ruta: {
    id: number;
    nombre: string;
    descripcion: string;
    origen: string;
    destino: string;
  };
  paradas: Parada[];
};

type Punto = {
  latitud: number;
  longitud: number;
};

const SVG_WIDTH = 340;
const SVG_HEIGHT = 230;

const caminoVisual = [
  { x: 28, y: 160 },
  { x: 80, y: 130 },
  { x: 135, y: 150 },
  { x: 195, y: 95 },
  { x: 250, y: 115 },
  { x: 315, y: 75 },
];

function convertirNumero(valor: string | number | undefined): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function gradosARadianes(grados: number) {
  return (grados * Math.PI) / 180;
}

function distanciaMetros(a: Punto, b: Punto) {
  const radioTierra = 6371000;

  const dLat = gradosARadianes(b.latitud - a.latitud);
  const dLon = gradosARadianes(b.longitud - a.longitud);

  const lat1 = gradosARadianes(a.latitud);
  const lat2 = gradosARadianes(b.latitud);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * radioTierra * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function textoDistancia(metros: number) {
  if (!Number.isFinite(metros)) return "Esperando ubicación";

  if (metros < 1000) {
    return `${Math.round(metros)} metros`;
  }

  return `${(metros / 1000).toFixed(2)} km`;
}

function distanciaTotalRuta(puntos: Punto[]) {
  let total = 0;

  for (let i = 0; i < puntos.length - 1; i++) {
    total += distanciaMetros(puntos[i], puntos[i + 1]);
  }

  return total;
}

function progresoSobreRuta(punto: Punto, ruta: Punto[]) {
  if (ruta.length < 2) return 0;

  let mejorDistancia = Infinity;
  let mejorProgreso = 0;
  let distanciaAcumulada = 0;
  const totalRuta = distanciaTotalRuta(ruta);

  for (let i = 0; i < ruta.length - 1; i++) {
    const inicio = ruta[i];
    const fin = ruta[i + 1];

    const dx = fin.longitud - inicio.longitud;
    const dy = fin.latitud - inicio.latitud;
    const longitudSegmentoCuadrada = dx * dx + dy * dy;

    if (longitudSegmentoCuadrada === 0) continue;

    let t =
      ((punto.longitud - inicio.longitud) * dx +
        (punto.latitud - inicio.latitud) * dy) /
      longitudSegmentoCuadrada;

    t = Math.max(0, Math.min(1, t));

    const puntoProyectado: Punto = {
      latitud: inicio.latitud + t * dy,
      longitud: inicio.longitud + t * dx,
    };

    const distanciaAlCamino = distanciaMetros(punto, puntoProyectado);
    const largoSegmento = distanciaMetros(inicio, fin);
    const progresoMetros = distanciaAcumulada + largoSegmento * t;

    if (distanciaAlCamino < mejorDistancia) {
      mejorDistancia = distanciaAlCamino;
      mejorProgreso = totalRuta > 0 ? progresoMetros / totalRuta : 0;
    }

    distanciaAcumulada += largoSegmento;
  }

  return Math.max(0, Math.min(1, mejorProgreso));
}

function puntoVisualPorProgreso(progreso: number) {
  const p = Math.max(0, Math.min(1, progreso));
  const segmentos = [];

  let total = 0;

  for (let i = 0; i < caminoVisual.length - 1; i++) {
    const a = caminoVisual[i];
    const b = caminoVisual[i + 1];

    const largo = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

    segmentos.push({ a, b, largo });
    total += largo;
  }

  const objetivo = total * p;
  let acumulado = 0;

  for (const segmento of segmentos) {
    if (acumulado + segmento.largo >= objetivo) {
      const local = (objetivo - acumulado) / segmento.largo;

      return {
        x: segmento.a.x + (segmento.b.x - segmento.a.x) * local,
        y: segmento.a.y + (segmento.b.y - segmento.a.y) * local,
      };
    }

    acumulado += segmento.largo;
  }

  return caminoVisual[caminoVisual.length - 1];
}

function pathCamino() {
  return `
    M 28 160
    C 60 110, 95 175, 135 145
    S 190 75, 230 110
    S 280 120, 315 75
  `;
}

export default function SeguimientoScreen() {
  const [estadoBus, setEstadoBus] = useState<BusEstado | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [ubicacionUsuario, setUbicacionUsuario] = useState<Punto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarDatos = async () => {
    try {
      const [estadoRes, rutaRes] = await Promise.all([
        fetch(`${BASE_URL}/api/bus/1/ultimo-estado`),
        fetch(`${BASE_URL}/api/rutas/1`),
      ]);

      if (!estadoRes.ok || !rutaRes.ok) {
        throw new Error("No se pudieron cargar los datos del bus");
      }

      const estadoData: BusEstado = await estadoRes.json();
      const rutaData: RutaResponse = await rutaRes.json();

      setEstadoBus(estadoData);
      setParadas(Array.isArray(rutaData.paradas) ? rutaData.paradas : []);
      setError("");
    } catch (e) {
      console.error(e);
      setError(
        "No se pudieron cargar los datos. Verifica que Railway esté encendido.",
      );
    } finally {
      setCargando(false);
    }
  };

  const obtenerUbicacionUsuario = async () => {
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();

      if (permiso.status !== "granted") {
        setError("Activa el permiso de ubicación para calcular la distancia.");
        return;
      }

      const ubicacion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUbicacionUsuario({
        latitud: ubicacion.coords.latitude,
        longitud: ubicacion.coords.longitude,
      });
    } catch (e) {
      console.error(e);
      setError("No se pudo obtener la ubicación del teléfono.");
    }
  };

  useEffect(() => {
    cargarDatos();
    obtenerUbicacionUsuario();

    const intervalo = setInterval(() => {
      cargarDatos();
      obtenerUbicacionUsuario();
    }, 5000);

    return () => clearInterval(intervalo);
  }, []);

  const datos = useMemo(() => {
    if (!estadoBus) return null;

    const bus: Punto = {
      latitud: convertirNumero(estadoBus.latitud),
      longitud: convertirNumero(estadoBus.longitud),
    };

    const ruta: Punto[] = paradas.map((p) => ({
      latitud: convertirNumero(p.latitud),
      longitud: convertirNumero(p.longitud),
    }));

    const rutaValida = ruta.length >= 2;
    const progresoBus = rutaValida ? progresoSobreRuta(bus, ruta) : 0.4;

    const progresoUsuario =
      ubicacionUsuario && rutaValida
        ? progresoSobreRuta(ubicacionUsuario, ruta)
        : 0.7;

    const puntoBus = puntoVisualPorProgreso(progresoBus);
    const puntoUsuario = puntoVisualPorProgreso(progresoUsuario);

    const distancia =
      ubicacionUsuario && bus.latitud !== 0 && bus.longitud !== 0
        ? distanciaMetros(ubicacionUsuario, bus)
        : NaN;

    let mensaje = "Esperando ubicación real del bus";

    if (ubicacionUsuario && bus.latitud !== 0 && bus.longitud !== 0) {
      if (Math.abs(progresoBus - progresoUsuario) < 0.05) {
        mensaje = "El bus está muy cerca de tu ubicación";
      } else if (progresoBus < progresoUsuario) {
        mensaje = "El bus viene hacia tu ubicación";
      } else {
        mensaje = "El bus ya pasó tu ubicación";
      }
    }

    return {
      distancia,
      progresoBus,
      progresoUsuario,
      puntoBus,
      puntoUsuario,
      mensaje,
    };
  }, [estadoBus, paradas, ubicacionUsuario]);

  const capacidad = convertirNumero(estadoBus?.capacidad);
  const pasajeros = convertirNumero(estadoBus?.cantidad);
  const disponibles = Math.max(0, capacidad - pasajeros);

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="bus-clock" size={52} color="#1d4ed8" />
        <Text style={styles.loadingText}>Cargando seguimiento...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#2563eb" />
        <Text style={styles.backText}>Regresar</Text>
      </TouchableOpacity>

      <View style={styles.headerBox}>
        <View style={styles.headerIconBox}>
          <MaterialCommunityIcons
            name="map-marker-path"
            size={34}
            color="#fff"
          />
        </View>

        <Text style={styles.title}>Seguimiento del bus</Text>
        <Text style={styles.subtitle}>
          Vista visual del recorrido, distancia y ubicación del bus
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {estadoBus?.codigo_bus || "BUS-01"} · {estadoBus?.ruta || "Ruta"}
        </Text>

        <Text style={styles.distanceText}>
          {datos ? textoDistancia(datos.distancia) : "Calculando..."}
        </Text>

        <Text style={styles.statusText}>
          {datos?.mensaje || "Calculando estado del bus"}
        </Text>

        <View style={styles.quickRow}>
          <View style={styles.quickBox}>
            <Text style={styles.quickNumber}>{pasajeros}</Text>
            <Text style={styles.quickLabel}>Pasajeros</Text>
          </View>

          <View style={styles.quickBox}>
            <Text style={styles.quickNumber}>{disponibles}</Text>
            <Text style={styles.quickLabel}>Disponibles</Text>
          </View>

          <View style={styles.quickBox}>
            <Text style={styles.quickNumber}>{estadoBus?.velocidad ?? 0}</Text>
            <Text style={styles.quickLabel}>km/h</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapCard}>
        <Text style={styles.mapTitle}>Ruta tipo caminito</Text>

        <View style={styles.svgWrapper}>
          <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
            <Rect
              x="0"
              y="0"
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              rx="22"
              fill="#e0f2fe"
            />

            <Path
              d={pathCamino()}
              stroke="#475569"
              strokeWidth="20"
              strokeLinecap="round"
              fill="none"
            />

            <Path
              d={pathCamino()}
              stroke="#facc15"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="12 12"
              fill="none"
            />

            {caminoVisual.map((p, index) => (
              <Circle
                key={`parada-${index}`}
                cx={p.x}
                cy={p.y}
                r="7"
                fill="#2563eb"
              />
            ))}

            {datos && (
              <>
                <Circle
                  cx={datos.puntoUsuario.x}
                  cy={datos.puntoUsuario.y}
                  r="17"
                  fill="#16a34a"
                />

                <Circle
                  cx={datos.puntoBus.x}
                  cy={datos.puntoBus.y}
                  r="18"
                  fill="#ef4444"
                />
              </>
            )}
          </Svg>

          {datos && (
            <>
              <View
                style={[
                  styles.iconFloating,
                  {
                    left: datos.puntoUsuario.x - 15,
                    top: datos.puntoUsuario.y - 17,
                  },
                ]}
              >
                <Ionicons name="person" size={22} color="#fff" />
              </View>

              <View
                style={[
                  styles.iconFloating,
                  {
                    left: datos.puntoBus.x - 16,
                    top: datos.puntoBus.y - 18,
                  },
                ]}
              >
                <MaterialCommunityIcons name="bus" size={24} color="#fff" />
              </View>
            </>
          )}
        </View>

        <View style={styles.routeLabels}>
          <Text style={styles.routeLabel}>{estadoBus?.origen || "Origen"}</Text>
          <Text style={styles.routeLabel}>
            {estadoBus?.destino || "Destino"}
          </Text>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
            <Text style={styles.legendText}>Bus</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#16a34a" }]} />
            <Text style={styles.legendText}>Tú</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos técnicos</Text>

        <Text style={styles.detailText}>
          Coordenadas del bus: {estadoBus?.latitud}, {estadoBus?.longitud}
        </Text>

        <Text style={styles.detailText}>
          Última actualización: {estadoBus?.fecha_hora || "Sin dato"}
        </Text>

        <Text style={styles.detailText}>
          Entradas detectadas: {estadoBus?.entradas_detectadas ?? 0}
        </Text>

        <Text style={styles.detailText}>
          Salidas detectadas: {estadoBus?.salidas_detectadas ?? 0}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => {
          setCargando(true);
          cargarDatos();
          obtenerUbicacionUsuario();
        }}
      >
        <Ionicons name="refresh" size={22} color="#fff" />
        <Text style={styles.refreshText}>Actualizar seguimiento</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#eef3f8",
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef3f8",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 18,
    color: "#334155",
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  backText: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "800",
  },
  headerBox: {
    backgroundColor: "#0b1736",
    borderRadius: 26,
    padding: 22,
    marginBottom: 18,
  },
  headerIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#1d4ed8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#cbd5e1",
    lineHeight: 22,
  },
  errorText: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#1e293b",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 30,
    fontWeight: "900",
    color: "#2563eb",
    marginTop: 8,
  },
  statusText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "800",
    color: "#16a34a",
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  quickBox: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  quickNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1d4ed8",
  },
  quickLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
  },
  mapCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 18,
    alignItems: "center",
    shadowColor: "#1e293b",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  mapTitle: {
    alignSelf: "flex-start",
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },
  svgWrapper: {
    width: SVG_WIDTH,
    height: SVG_HEIGHT,
    position: "relative",
  },
  iconFloating: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  routeLabels: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 8,
  },
  routeLabel: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "800",
  },
  legendRow: {
    flexDirection: "row",
    gap: 22,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "700",
  },
  detailText: {
    fontSize: 15,
    color: "#475569",
    marginTop: 8,
  },
  refreshButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
});
