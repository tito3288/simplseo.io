"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { saveOnboardingData, getOnboardingData } from "../lib/firestoreHelpers";
import { useAuth } from "./AuthContext";

const initialData = {
  businessName: "",
  websiteUrl: "",
  businessType: "",
  businessLocation: "",
  cmsPlatform: "",
  hasGSC: false,
  isComplete: false,
};

const OnboardingContext = createContext(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};

export const OnboardingProvider = ({ children }) => {
  const [data, setData] = useState(initialData);
  const { user } = useAuth();

  useEffect(() => {
    const loadFromFirestore = async () => {
      if (user) {
        try {
          const firestoreData = await getOnboardingData(user.id);
          if (firestoreData) {
            setData(firestoreData);
          } else {
            setData(initialData);
          }
        } catch (err) {
          console.error("Failed to fetch onboarding data:", err);
        }
      }
    };

    loadFromFirestore();
  }, [user]);

  const updateData = (newData) => {
    setData((prevData) => {
      const updated = { ...prevData, ...newData };
      if (user) {
        saveOnboardingData(user.id, updated).catch((err) =>
          console.error("❌ Failed to save onboarding field:", err)
        );
      }
      return updated;
    });
  };

  const resetData = () => {
    setData(initialData);
    if (user) {
      saveOnboardingData(user.id, initialData);
    }
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData, resetData }}>
      {children}
    </OnboardingContext.Provider>
  );
};
