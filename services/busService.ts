import { BusData } from "../types/bus";

const BASE_URL = "https://bus-api-production.up.railway.app";

export function subscribeToBusData(callback: (data: BusData) => void) {
  let activo = true;

  const cargarDatos = async () => {
    try {
      const [estadoRes, rutaRes] = await Promise.all([
        fetch(`${BASE_URL}/api/bus/1/ultimo-estado`),
        fetch(`${BASE_URL}/api/rutas/1`),
      ]);

      if (!estadoRes.ok || !rutaRes.ok) {
        throw new Error("No se pudieron obtener los datos del backend");
      }

      const estadoData = await estadoRes.json();
      const rutaData = await rutaRes.json();

      if (!activo) return;

      const capacidad = Number(estadoData.capacidad ?? 0);
      const cantidad = Number(estadoData.cantidad ?? 0);

      const entradasDetectadas = Number(
        estadoData.entradas_detectadas ?? cantidad,
      );

      const salidasDetectadas = Number(estadoData.salidas_detectadas ?? 0);

      const busData: BusData = {
        busId: estadoData.codigo_bus || "BUS-01",
        routeName: estadoData.ruta || "Ruta desconocida",
        latitude: Number(estadoData.latitud ?? 0),
        longitude: Number(estadoData.longitud ?? 0),
        currentPassengers: cantidad,
        capacity: capacidad,
        entries: entradasDetectadas,
        exits: salidasDetectadas,
        lastUpdate: estadoData.fecha_hora || new Date().toLocaleString(),
        stops: Array.isArray(rutaData.paradas)
          ? rutaData.paradas.map((p: any) => p.nombre)
          : [],
      };

      callback(busData);
    } catch (error) {
      console.error("Error al cargar datos del backend:", error);
    }
  };

  cargarDatos();

  const interval = setInterval(cargarDatos, 4000);

  return () => {
    activo = false;
    clearInterval(interval);
  };
}
