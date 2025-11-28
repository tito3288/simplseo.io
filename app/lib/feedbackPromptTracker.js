import { db } from "./firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Get feedback prompt data for a user
 */
export async function getFeedbackPromptData(userId) {
  if (!userId) return null;
  
  try {
    const promptRef = doc(db, "users", userId, "feedbackPrompt", "data");
    const snapshot = await getDoc(promptRef);
    
    if (snapshot.exists()) {
      return snapshot.data();
    }
    return null;
  } catch (error) {
    // Silently handle permission errors - rules might not be deployed yet
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null;
    }
    console.error("Error getting feedback prompt data:", error);
    return null;
  }
}

/**
 * Initialize feedback tracking on first dashboard visit
 */
export async function initializeFeedbackTracking(userId) {
  if (!userId) return;
  
  try {
    const promptRef = doc(db, "users", userId, "feedbackPrompt", "data");
    const snapshot = await getDoc(promptRef);
    
    // Only initialize if doesn't exist
    if (!snapshot.exists()) {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      await setDoc(promptRef, {
        firstDashboardVisit: serverTimestamp(),
        nextPromptDate: sevenDaysLater.toISOString(),
        hasSubmittedFeedback: false,
        promptCount: 0,
        clickedFeedbackButton: false,
        lastPromptShown: null,
      });
      
      console.log("✅ Feedback tracking initialized");
    }
  } catch (error) {
    // Silently handle permission errors - rules might not be deployed yet or auth not ready
    // This is non-critical functionality and shouldn't break the app
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      // Silently fail - rules may not be deployed yet, or auth might not be fully ready
      // The feature will work once rules are deployed
      return;
    }
    // Only log non-permission errors
    console.error("Error initializing feedback tracking:", error);
  }
}

/**
 * Check if feedback prompt should be shown
 */
export async function shouldShowFeedbackPrompt(userId) {
  if (!userId) return false;
  
  try {
    const data = await getFeedbackPromptData(userId);
    if (!data) return false;
    
    // Don't show if already submitted
    if (data.hasSubmittedFeedback) return false;
    
    // Check if it's time to show
    const now = new Date();
    const nextPromptDate = new Date(data.nextPromptDate);
    
    return now >= nextPromptDate;
  } catch (error) {
    // Silently handle errors - don't break the app
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return false;
    }
    return false;
  }
}

/**
 * Update when user closes/dismisses prompt
 */
export async function updatePromptDismissed(userId) {
  if (!userId) return;
  
  try {
    const promptRef = doc(db, "users", userId, "feedbackPrompt", "data");
    const snapshot = await getDoc(promptRef);
    
    if (snapshot.exists()) {
      const data = snapshot.data();
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      
      await setDoc(promptRef, {
        ...data,
        lastPromptShown: now.toISOString(),
        nextPromptDate: threeDaysLater.toISOString(),
        promptCount: (data.promptCount || 0) + 1,
      }, { merge: true });
      
      console.log("✅ Feedback prompt dismissed, will show again in 3 days");
    }
  } catch (error) {
    // Silently handle permission errors
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return;
    }
    console.error("Error updating prompt dismissed:", error);
  }
}

/**
 * Mark that user clicked feedback button
 */
export async function markFeedbackButtonClicked(userId) {
  if (!userId) return;
  
  try {
    const promptRef = doc(db, "users", userId, "feedbackPrompt", "data");
    const snapshot = await getDoc(promptRef);
    
    if (snapshot.exists()) {
      const data = snapshot.data();
      await setDoc(promptRef, {
        ...data,
        clickedFeedbackButton: true,
        lastPromptShown: new Date().toISOString(),
      }, { merge: true });
      
      console.log("✅ Feedback button clicked");
    }
  } catch (error) {
    // Silently handle permission errors
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return;
    }
    console.error("Error marking feedback button clicked:", error);
  }
}

/**
 * Mark feedback as submitted (stops all future prompts)
 */
export async function markFeedbackSubmitted(userId) {
  if (!userId) return;
  
  try {
    const promptRef = doc(db, "users", userId, "feedbackPrompt", "data");
    await setDoc(promptRef, {
      hasSubmittedFeedback: true,
    }, { merge: true });
    
    console.log("✅ Feedback submitted - stopping prompts");
  } catch (error) {
    // Silently handle permission errors
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return;
    }
    console.error("Error marking feedback submitted:", error);
  }
}

