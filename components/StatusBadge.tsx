import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  passengers: number;
  capacity: number;
};

export default function StatusBadge({ passengers, capacity }: Props) {
  const percent = (passengers / capacity) * 100;

  let label = "Disponible";
  let bgColor = "#1f8f4d";

  if (percent >= 90) {
    label = "Lleno";
    bgColor = "#d62828";
  } else if (percent >= 61) {
    label = "Casi lleno";
    bgColor = "#f4a100";
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});
