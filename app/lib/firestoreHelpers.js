import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

// Save onboarding data
export const saveOnboardingData = async (userId, data) => {
  try {
    const docRef = doc(db, "onboarding", userId);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("Failed to save onboarding data:", error);
    throw error;
  }
};

// Get onboarding data
export const getOnboardingData = async (userId) => {
  try {
    const docRef = doc(db, "onboarding", userId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error("Failed to fetch onboarding data:", error);
    throw error;
  }
};
