import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc,
} from "firebase/firestore/lite";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use Lite SDK to avoid background 'Listen' streams in sandboxed environments
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Mandatory connection test per system instructions
async function testConnection() {
  try {
    await getDoc(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase connection test failed: check your configuration or network.");
    }
  }
}
testConnection();

export default app;
