import type { ExpoConfig } from "expo/config";
import app from "./app.json";

export default (): ExpoConfig => {
  const localHttp =
    process.env.EXPO_PUBLIC_API_URL?.startsWith("http://") ?? false;
  const plugins = (app.expo.plugins as ExpoConfig["plugins"]) ?? [];
  return {
    ...app.expo,
    plugins: [
      ...plugins.filter(
        (plugin) =>
          (Array.isArray(plugin) ? plugin[0] : plugin) !==
          "expo-build-properties",
      ),
      [
        "expo-build-properties",
        { android: { usesCleartextTraffic: localHttp } },
      ],
    ],
  } as ExpoConfig;
};
