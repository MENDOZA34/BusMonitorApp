import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import InfoCard from "../components/InfoCard";
import StatusBadge from "../components/StatusBadge";
import { subscribeToBusData } from "../services/busService";
import { BusData } from "../types/bus";

export default function HomeScreen() {
  const [busData, setBusData] = useState<BusData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBusData(setBusData);
    return unsubscribe;
  }, []);

  if (!busData) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="bus-clock" size={52} color="#1d4ed8" />
        <Text style={styles.loadingText}>Cargando datos del bus...</Text>
      </View>
    );
  }

  const availableSeats = busData.capacity - busData.currentPassengers;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBox}>
        <View style={styles.headerIconBox}>
          <MaterialCommunityIcons
            name="bus-multiple"
            size={34}
            color="#ffffff"
          />
        </View>

        <Text style={styles.title}>
          Sistema Inteligente de Monitoreo de Buses
        </Text>
        <Text style={styles.subtitle}>
          Monitoreo de pasajeros, rutas y ubicación
        </Text>
      </View>

      <InfoCard title="Resumen del bus">
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="card-account-details-outline"
            size={20}
            color="#25caeb"
          />
          <Text style={styles.infoText}>ID del bus: {busData.busId}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={20} color="#2563eb" />
          <Text style={styles.infoText}>Ruta: {busData.routeName}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={20}
            color="#25eb67"
          />
          <Text style={styles.infoText}>
            Pasajeros actuales: {busData.currentPassengers}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="bus-school" size={20} color="#ebb025" />
          <Text style={styles.infoText}>Capacidad: {busData.capacity}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="seat-passenger"
            size={20}
            color="#eb2585"
          />
          <Text style={styles.infoText}>
            Espacios disponibles: {availableSeats}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={20} color="#2563eb" />
          <Text style={styles.infoText}>
            Última actualización: {busData.lastUpdate}
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <StatusBadge
            passengers={busData.currentPassengers}
            capacity={busData.capacity}
          />
        </View>
      </InfoCard>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/mapa" as any)}
      >
        <Ionicons name="map-outline" size={22} color="#fff" />
        <Text style={styles.buttonText}>Ver mapa</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/ruta" as any)}
      >
        <Ionicons name="navigate-outline" size={22} color="#fff" />
        <Text style={styles.buttonText}>Ver ruta</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/estado" as any)}
      >
        <MaterialCommunityIcons name="chart-donut" size={22} color="#fff" />
        <Text style={styles.buttonText}>Ver estado del bus</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/detalle" as any)}
      >
        <Ionicons name="document-text-outline" size={22} color="#fff" />
        <Text style={styles.buttonText}>Ver detalles</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#eef3f8",
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
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 17,
    color: "#334155",
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 18,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
  },
});
