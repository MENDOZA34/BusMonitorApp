import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
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
        <Text>Cargando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: busData.latitude,
          longitude: busData.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        region={{
          latitude: busData.latitude,
          longitude: busData.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{
            latitude: busData.latitude,
            longitude: busData.longitude,
          }}
          title="Bus actual"
          description={busData.routeName}
        />
      </MapView>

      <View style={styles.infoBox}>
        <View style={styles.row}>
          <Ionicons name="navigate-outline" size={20} color="#2563eb" />
          <Text style={styles.infoText}>Ruta: {busData.routeName}</Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={20}
            color="#2563eb"
          />
          <Text style={styles.infoText}>
            Pasajeros: {busData.currentPassengers}
          </Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="location-outline" size={20} color="#2563eb" />
          <Text style={styles.infoText}>
            Ubicación: {busData.latitude.toFixed(5)},{" "}
            {busData.longitude.toFixed(5)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef3f8",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  map: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 17,
    color: "#334155",
    lineHeight: 24,
  },
});
