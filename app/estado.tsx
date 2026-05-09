import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import InfoCard from "../components/InfoCard";
import StatusBadge from "../components/StatusBadge";
import { subscribeToBusData } from "../services/busService";
import { BusData } from "../types/bus";

export default function EstadoScreen() {
  const [busData, setBusData] = useState<BusData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBusData(setBusData);
    return unsubscribe;
  }, []);

  if (!busData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando estado...</Text>
      </View>
    );
  }

  const availableSeats = busData.capacity - busData.currentPassengers;
  const percent = (
    (busData.currentPassengers / busData.capacity) *
    100
  ).toFixed(1);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBox}>
        <MaterialCommunityIcons name="chart-arc" size={34} color="#fff" />
        <Text style={styles.topTitle}>Estado actual del bus</Text>
        <Text style={styles.topSubtitle}>
          Consulta rápida del nivel de ocupación
        </Text>
      </View>

      <InfoCard title="Resumen de ocupación">
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={22}
            color="#976d0a"
          />
          <Text style={styles.text}>
            Pasajeros actuales: {busData.currentPassengers}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="bus-school" size={22} color="#25b6eb" />
          <Text style={styles.text}>Capacidad máxima: {busData.capacity}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="seat-passenger"
            size={22}
            color="#c025eb"
          />
          <Text style={styles.text}>
            Espacios disponibles: {availableSeats}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="chart-donut"
            size={22}
            color="#eb254d"
          />
          <Text style={styles.text}>Ocupación: {percent}%</Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <StatusBadge
            passengers={busData.currentPassengers}
            capacity={busData.capacity}
          />
        </View>
      </InfoCard>
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
  },
  topBox: {
    backgroundColor: "#0b1736",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
  },
  topTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },
  topSubtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    marginTop: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 18,
    color: "#334155",
    lineHeight: 24,
  },
});
