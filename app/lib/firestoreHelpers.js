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

// Save internal link suggestion
export const setInternalLinkSuggestion = async (userId, pageUrl, suggestion) => {
  try {
    const docId = `${userId}_${encodeURIComponent(pageUrl)}`;
    const docRef = doc(db, "internalLinkSuggestions", docId);
    await setDoc(docRef, suggestion, { merge: true });
  } catch (error) {
    console.error("Failed to save internal link suggestion:", error);
    throw error;
  }
};

// Get internal link suggestion
export const getInternalLinkSuggestion = async (userId, pageUrl) => {
  try {
    const docId = `${userId}_${encodeURIComponent(pageUrl)}`;
    const docRef = doc(db, "internalLinkSuggestions", docId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error("Failed to fetch internal link suggestion:", error);
    throw error;
  }
};

// Save content audit result
export const saveContentAuditResult = async (userId, pageUrl, auditResult) => {
  try {
    const docId = `${userId}_${encodeURIComponent(pageUrl)}`;
    const docRef = doc(db, "contentAuditResults", docId);
    await setDoc(docRef, {
      ...auditResult,
      pageUrl,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error("Failed to save content audit result:", error);
    throw error;
  }
};

// Get content audit result
export const getContentAuditResult = async (userId, pageUrl) => {
  try {
    const docId = `${userId}_${encodeURIComponent(pageUrl)}`;
    const docRef = doc(db, "contentAuditResults", docId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error("Failed to fetch content audit result:", error);
    throw error;
  }
};

// Save AI suggestions
export const saveAiSuggestions = async (userId, pageUrl, suggestions) => {
  try {
    const docId = `${userId}_${encodeURIComponent(pageUrl)}`;
    const docRef = doc(db, "aiSuggestions", docId);
    await setDoc(docRef, {
      ...suggestions,
      pageUrl,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error("Failed to save AI suggestions:", error);
    throw error;
  }
};

// Get AI suggestions
export const getAiSuggestions = async (userId, pageUrl) => {
  try {
    const docId = `${userId}_${encodeURIComponent(pageUrl)}`;
    const docRef = doc(db, "aiSuggestions", docId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error("Failed to fetch AI suggestions:", error);
    throw error;
  }
};
