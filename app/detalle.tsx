import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import InfoCard from "../components/InfoCard";
import { subscribeToBusData } from "../services/busService";
import { BusData } from "../types/bus";

export default function DetalleScreen() {
  const [busData, setBusData] = useState<BusData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBusData(setBusData);
    return unsubscribe;
  }, []);

  if (!busData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando detalles...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBox}>
        <Ionicons name="document-text-outline" size={34} color="#fff" />
        <Text style={styles.topTitle}>Detalles del monitoreo</Text>
        <Text style={styles.topSubtitle}>
          Información técnica del conteo y ubicación
        </Text>
      </View>

      <InfoCard title="Detalle del monitoreo">
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="card-account-details-outline"
            size={22}
            color="#2563eb"
          />
          <Text style={styles.text}>ID del bus: {busData.busId}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="login-variant"
            size={22}
            color="#2563eb"
          />
          <Text style={styles.text}>
            Entradas detectadas: {busData.entries}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="logout-variant"
            size={22}
            color="#2563eb"
          />
          <Text style={styles.text}>Salidas detectadas: {busData.exits}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={22} color="#2563eb" />
          <Text style={styles.text}>
            Última actualización: {busData.lastUpdate}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={22} color="#2563eb" />
          <Text style={styles.text}>
            Coordenadas: {busData.latitude.toFixed(5)},{" "}
            {busData.longitude.toFixed(5)}
          </Text>
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
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 18,
    color: "#334155",
    lineHeight: 26,
  },
});
