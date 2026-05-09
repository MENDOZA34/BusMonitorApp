import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { subscribeToBusData } from "../services/busService";
import { BusData } from "../types/bus";

export default function MapaScreen() {
  const [busData, setBusData] = useState<BusData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBusData(setBusData);
    return unsubscribe;
  }, []);

  if (!busData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando ubicación...</Text>
      </View>
    );
  }

  const latitude = Number(busData.latitude ?? 0);
  const longitude = Number(busData.longitude ?? 0);

  const coordenadasValidas =
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude !== 0 &&
    longitude !== 0;

  const abrirGoogleMaps = async () => {
    if (!coordenadasValidas) {
      Alert.alert(
        "Ubicación no disponible",
        "Todavía no hay coordenadas válidas del GPS. Encienda el ESP32 y espere señal del GPS.",
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Error", "No se pudo abrir Google Maps.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map-outline" size={46} color="#ffffff" />
        <Text style={styles.headerTitle}>Ubicación del bus</Text>
        <Text style={styles.headerSubtitle}>Monitoreo de la posición</Text>
      </View>

      <View style={styles.infoBox}>
        <View style={styles.row}>
          <Ionicons name="bus-outline" size={22} color="#56eb25" />
          <Text style={styles.infoText}>ID del bus: {busData.busId}</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="navigate-outline" size={22} color="#25d1eb" />
          <Text style={styles.infoText}>Ruta: {busData.routeName}</Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={22}
            color="#cd25eb"
          />
          <Text style={styles.infoText}>
            Pasajeros actuales: {busData.currentPassengers}
          </Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="location-outline" size={22} color="#eb6725" />
          <Text style={styles.infoText}>
            Coordenadas: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="time-outline" size={22} color="#2563eb" />
          <Text style={styles.infoText}>
            Última actualización: {busData.lastUpdate}
          </Text>
        </View>

        {!coordenadasValidas && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={22} color="#b45309" />
            <Text style={styles.warningText}>
              Ubicación no disponible todavía. El GPS está apagado, sin señal o
              está enviando coordenadas 0,0.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={abrirGoogleMaps}>
          <Ionicons name="map-outline" size={22} color="#ffffff" />
          <Text style={styles.buttonText}>Abrir ubicación en Google Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef3f8",
    padding: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef3f8",
  },
  loadingText: {
    fontSize: 18,
    color: "#334155",
  },
  header: {
    backgroundColor: "#111827",
    padding: 24,
    borderRadius: 26,
    marginBottom: 20,
    marginTop: 20,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 14,
  },
  headerSubtitle: {
    color: "#cbd5e1",
    fontSize: 16,
    marginTop: 8,
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 17,
    color: "#334155",
    lineHeight: 24,
  },
  warningBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fef3c7",
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    color: "#92400e",
    lineHeight: 21,
  },
  button: {
    backgroundColor: "#25a2eb",
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  buttonText: {
    color: "#f0f76e",
    fontSize: 17,
    fontWeight: "bold",
  },
});
