import { BusData } from "../types/bus";

export const mockBusData: BusData = {
  busId: "BUS-01",
  routeName: "Ruta Centro - Mercado - Terminal",
  latitude: 14.6349,
  longitude: -90.5069,
  currentPassengers: 18,
  capacity: 30,
  entries: 25,
  exits: 7,
  lastUpdate: "2026-04-15 10:30 AM",
  stops: ["Parada Central", "Mercado", "Parque", "Hospital", "Terminal"],
};
