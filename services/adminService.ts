import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { BASE_URL } from "./apiConfig";

const KEY = "busmonitor.admin.session";
let token: string | null = null;
let onExpired: (() => void) | undefined;
export function setSessionExpiredHandler(handler?: () => void) {
  onExpired = handler;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function saveToken(value: string | null) {
  token = value;
  if (Platform.OS !== "web") {
    if (value)
      await SecureStore.setItemAsync(
        KEY,
        JSON.stringify({ base: BASE_URL, token: value }),
      );
    else await SecureStore.deleteItemAsync(KEY);
  }
}
export async function restoreToken() {
  if (Platform.OS === "web") return token;
  const stored = await SecureStore.getItemAsync(KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    if (session.base !== BASE_URL || !/^[a-f0-9]{64}$/.test(session.token)) {
      await saveToken(null);
      return null;
    }
    token = session.token;
    return token;
  } catch {
    await saveToken(null);
    return null;
  }
}
export async function adminRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE_URL}/api/admin${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && path !== "/auth/login") {
        await saveToken(null);
        onExpired?.();
      }
      throw new ApiError(
        res.status,
        data.error || `Error del servidor (${res.status})`,
      );
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      "No se pudo conectar al backend. Compruebe la red y vuelva a intentar.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function logout() {
  try {
    await adminRequest("/auth/logout", "POST");
  } finally {
    await saveToken(null);
  }
}
export async function downloadWeeklyPdf(
  busId: string,
  fecha: string,
  share = false,
) {
  if (Platform.OS !== "android" && Platform.OS !== "web")
    throw new Error("La descarga esta disponible en Android y Web");
  if (Platform.OS === "web" && share)
    throw new Error("Compartir PDF esta disponible en Android");
  if (!token) throw new ApiError(401, "Sesion requerida");
  const name = `BusMonitor_${busId}_${fecha}.pdf`;
  if (Platform.OS === "web") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await fetch(
        `${BASE_URL}/api/admin/reportes/semanal.pdf?bus_id=${encodeURIComponent(busId)}&fecha=${encodeURIComponent(fecha)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: "no-store",
        },
      );
      if (!result.ok) {
        if (result.status === 401) {
          await saveToken(null);
          onExpired?.();
        }
        const data = await result.json().catch(() => ({}));
        throw new ApiError(
          result.status,
          data.error || "No se pudo generar el PDF",
        );
      }
      if (
        result.headers
          .get("Content-Type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() !== "application/pdf"
      )
        throw new Error("El servidor no devolvio un PDF valido");
      const url = URL.createObjectURL(await result.blob());
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        // Allow the browser to consume the blob before releasing it.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      return "Descarga del reporte iniciada";
    } finally {
      clearTimeout(timer);
    }
  }
  const target = `${FileSystem.cacheDirectory}${name}`;
  try {
    const result = await FileSystem.downloadAsync(
      `${BASE_URL}/api/admin/reportes/semanal.pdf?bus_id=${encodeURIComponent(busId)}&fecha=${encodeURIComponent(fecha)}`,
      target,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (result.status !== 200) {
      if (result.status === 401) {
        await saveToken(null);
        onExpired?.();
      }
      throw new ApiError(result.status, "No se pudo generar el PDF");
    }
    if (share) {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("No hay una aplicacion disponible para compartir");
      await Sharing.shareAsync(target, {
        mimeType: "application/pdf",
        dialogTitle: "Reporte semanal",
      });
      return "Reporte compartido";
    }
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) return "Guardado cancelado";
    const content = await FileSystem.readAsStringAsync(target, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      name,
      "application/pdf",
    );
    await FileSystem.writeAsStringAsync(uri, content, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return "Reporte guardado";
  } finally {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
  }
}
