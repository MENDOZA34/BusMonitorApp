import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import InfoCard from "../components/InfoCard";
import { subscribeToBusData } from "../services/busService";
import { BusData } from "../types/bus";

export default function RutaScreen() {
  const [busData, setBusData] = useState<BusData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBusData(setBusData);
    return unsubscribe;
  }, []);

  if (!busData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando ruta...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBox}>
        <Ionicons name="navigate-circle-outline" size={36} color="#fff" />
        <Text style={styles.topTitle}>Información de la ruta</Text>
        <Text style={styles.topSubtitle}>
          Consulta la ruta configurada y sus paradas
        </Text>
      </View>

      <InfoCard title="Ruta actual">
        <Text style={styles.routeName}>{busData.routeName}</Text>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="bus-school" size={22} color="#2563eb" />
          <Text style={styles.text}>Capacidad del bus: {busData.capacity}</Text>
        </View>
      </InfoCard>

      <InfoCard title="Paradas">
        {busData.stops.map((stop, index) => (
          <View key={index} style={styles.stopRow}>
            <View style={styles.stopNumber}>
              <Text style={styles.stopNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stopText}>{stop}</Text>
          </View>
        ))}
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
  routeName: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
    color: "#0f172a",
    lineHeight: 30,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  text: {
    fontSize: 17,
    color: "#334155",
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stopNumberText: {
    color: "#fff",
    fontWeight: "800",
  },
  stopText: {
    fontSize: 18,
    color: "#334155",
  },
});
