export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || "https://bus-api-production.up.railway.app"
).replace(/\/+$/, "");
