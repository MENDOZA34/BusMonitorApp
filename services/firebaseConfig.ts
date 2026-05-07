import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AQUI_TU_API_KEY",
  authDomain: "AQUI_TU_AUTH_DOMAIN",
  databaseURL: "https://ejemplo-default-rtdb.firebaseio.com",
  projectId: "AQUI_TU_PROJECT_ID",
  storageBucket: "AQUI_TU_STORAGE_BUCKET",
  messagingSenderId: "AQUI_TU_MESSAGING_SENDER_ID",
  appId: "AQUI_TU_APP_ID",
};

export function getFirebaseDatabase() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getDatabase(app);
}
