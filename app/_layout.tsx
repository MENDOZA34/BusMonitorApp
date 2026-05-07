import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#0b1736",
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 20,
        },
        contentStyle: {
          backgroundColor: "#eef3f8",
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Inicio" }} />
      <Stack.Screen name="mapa" options={{ title: "Mapa del bus" }} />
      <Stack.Screen name="ruta" options={{ title: "Ruta del bus" }} />
      <Stack.Screen name="estado" options={{ title: "Estado del bus" }} />
      <Stack.Screen
        name="detalle"
        options={{ title: "Detalles del monitoreo" }}
      />
    </Stack>
  );
}
