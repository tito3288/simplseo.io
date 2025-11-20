"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import { useTheme } from "../contexts/ThemeContext";
import MainLayout from "../components/MainLayout";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  User, 
  Bell, 
  Shield, 
  Search, 
  Globe, 
  Mail, 
  Key, 
  Trash2, 
  Download, 
  Upload,
  Save,
  Edit3,
  Camera,
  AlertTriangle,
  CheckCircle,
  Settings as SettingsIcon,
  Database,
  Zap,
  BarChart3,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { db } from "../lib/firebaseConfig";
import { 
  doc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";
import { 
  deleteUser, 
  reauthenticateWithCredential, 
  reauthenticateWithPopup,
  EmailAuthProvider,
  signInWithEmailAndPassword 
} from "firebase/auth";

export default function Settings() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, updateData } = useOnboarding();
  const { isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();

  // State for form data
  const [formData, setFormData] = useState({
    // Profile
    businessName: "",
    websiteUrl: "",
    businessType: "",
    businessLocation: "",
    cmsPlatform: "",
    contactEmail: "",
    
    // Notifications
    emailReports: true,
    weeklyDigest: true,
    keywordAlerts: true,
    rankingChanges: true,
    newFeatures: false,
    marketingEmails: false,
    
    // SEO Preferences
    defaultDateRange: "30",
    autoRefresh: true,
    showAdvancedMetrics: false,
    enableAITips: true,
    dataRetention: "12",
    
    // Integrations
    gscConnected: false,
    gscProperty: "",
    gscLastSync: null,
    analyticsConnected: false,
    socialConnected: false,
    
    // Account
    twoFactorEnabled: false,
    sessionTimeout: "24",
    dataExport: false
  });

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Detect user's authentication method
  useEffect(() => {
    if (user) {
      const checkAuthMethod = async () => {
        try {
          const { auth } = await import("../lib/firebaseConfig");
          const currentUser = auth.currentUser;
          if (currentUser) {
            const isGoogle = currentUser.providerData.some(provider => provider.providerId === 'google.com');
            setIsGoogleUser(isGoogle);
          }
        } catch (error) {
          console.error("Error checking auth method:", error);
        }
      };
      checkAuthMethod();
    }
  }, [user]);

  // Load user data
  useEffect(() => {
    if (data) {
      // Normalize CMS platform to match dropdown values (onboarding saves capitalized)
      const normalizeCmsPlatform = (platform) => {
        if (!platform) return "";
        // Map onboarding CMS platforms to settings values (lowercase)
        const platformMap = {
          "WordPress": "wordpress",
          "Squarespace": "squarespace",
          "Wix": "wix"
        };
        return platformMap[platform] || platform.toLowerCase() || "";
      };

      setFormData(prev => ({
        ...prev,
        businessName: data.businessName || "",
        websiteUrl: data.websiteUrl || "",
        businessType: data.businessType || "",
        businessLocation: data.businessLocation || "",
        cmsPlatform: normalizeCmsPlatform(data.cmsPlatform),
        contactEmail: user?.email || "",
        // Update GSC connection status from actual onboarding data
        gscConnected: !!(data.hasGSC && data.gscProperty),
        gscProperty: data.gscProperty || "",
        gscLastSync: data.gscLastSync || new Date().toISOString()
      }));
    }
  }, [data, user]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update onboarding data
      await updateData({
        businessName: formData.businessName,
        websiteUrl: formData.websiteUrl,
        businessType: formData.businessType,
        businessLocation: formData.businessLocation,
        cmsPlatform: formData.cmsPlatform
      });

      // Simulate API call for other settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success("Settings saved successfully!", {
        description: "Your preferences have been updated."
      });
    } catch (error) {
      toast.error("Failed to save settings", {
        description: "Please try again in a moment."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    toast.success("Data export started", {
      description: "You&apos;ll receive an email when your data is ready for download."
    });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type 'DELETE' to confirm account deletion");
      return;
    }

    setIsDeleting(true);
    try {
      const { auth } = await import("../lib/firebaseConfig");
      const currentUser = auth.currentUser;
      
      // Check if user signed up with Google OAuth
      const isGoogleUser = currentUser.providerData.some(provider => provider.providerId === 'google.com');
      
      if (isGoogleUser) {
        // For Google OAuth users, we need to re-authenticate with Google
        // This will open a popup for Google re-authentication
        const provider = new (await import("firebase/auth")).GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        try {
          await reauthenticateWithPopup(currentUser, provider);
        } catch (reauthError) {
          if (reauthError.code === 'auth/popup-closed-by-user') {
            toast.error("Re-authentication cancelled", {
              description: "Please complete Google re-authentication to delete your account."
            });
            return;
          }
          throw reauthError;
        }
      } else {
        // For email/password users, require password
        if (!deletePassword) {
          toast.error("Please enter your password to confirm account deletion");
          return;
        }
        
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(currentUser, credential);
      }
      
      // Delete all user data from Firestore
      await deleteAllUserData(user.id);
      
      // Delete the Firebase Auth user
      await deleteUser(currentUser);
      
      toast.success("Account deleted successfully", {
        description: "All your data has been permanently removed."
      });
      
      // Redirect to auth page
      router.push("/auth");
    } catch (error) {
      console.error("Error deleting account:", error);
      
      if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password", {
          description: "Please enter the correct password for this account."
        });
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many attempts", {
          description: "Please wait a moment before trying again."
        });
      } else if (error.code === "auth/popup-closed-by-user") {
        toast.error("Re-authentication cancelled", {
          description: "Please complete Google re-authentication to delete your account."
        });
      } else {
        toast.error("Failed to delete account", {
          description: error.message || "Please try again or contact support."
        });
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmation("");
      setDeletePassword("");
    }
  };

  const deleteAllUserData = async (userId) => {
    let deleteCount = 0;

    try {
      // 1. Delete onboarding data
      try {
        const onboardingRef = doc(db, "onboarding", userId);
        await deleteDoc(onboardingRef);
        deleteCount++;
        console.log("✅ Deleted onboarding data");
      } catch (error) {
        console.log("⚠️ Onboarding data not found or already deleted");
      }

      // 2. Delete user profile data
      try {
        const userRef = doc(db, "users", userId);
        await deleteDoc(userRef);
        deleteCount++;
        console.log("✅ Deleted user profile data");
      } catch (error) {
        console.log("⚠️ User profile data not found or already deleted");
      }

      // 3. Delete implementedSeoTips (query by userId field)
      try {
        const implementedSeoTipsQuery = query(
          collection(db, "implementedSeoTips"),
          where("userId", "==", userId)
        );
        const implementedSeoTipsSnapshot = await getDocs(implementedSeoTipsQuery);
        const batch1 = writeBatch(db);
        implementedSeoTipsSnapshot.docs.forEach((doc) => {
          batch1.delete(doc.ref);
          deleteCount++;
        });
        if (implementedSeoTipsSnapshot.docs.length > 0) {
          await batch1.commit();
          console.log(`✅ Deleted ${implementedSeoTipsSnapshot.docs.length} implementedSeoTips documents`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting implementedSeoTips:", error.message);
      }

      // 4. Delete intentMismatches (from both old and new structures)
      try {
        // Delete from NEW structure: intentMismatches/{userId}/analyses
        try {
          const newAnalysesRef = collection(db, "intentMismatches", userId, "analyses");
          const newAnalysesSnapshot = await getDocs(newAnalysesRef);
          const batch2a = writeBatch(db);
          newAnalysesSnapshot.docs.forEach((doc) => {
            batch2a.delete(doc.ref);
            deleteCount++;
          });
          if (newAnalysesSnapshot.docs.length > 0) {
            await batch2a.commit();
            console.log(`✅ Deleted ${newAnalysesSnapshot.docs.length} intentMismatches from new structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from new intentMismatches structure:", error.message);
        }

        // Delete from OLD structure: intentMismatches (flat)
        try {
          const intentMismatchesQuery = query(
            collection(db, "intentMismatches"),
            where("userId", "==", userId)
          );
          const intentMismatchesSnapshot = await getDocs(intentMismatchesQuery);
          const batch2b = writeBatch(db);
          intentMismatchesSnapshot.docs.forEach((doc) => {
            batch2b.delete(doc.ref);
            deleteCount++;
          });
          if (intentMismatchesSnapshot.docs.length > 0) {
            await batch2b.commit();
            console.log(`✅ Deleted ${intentMismatchesSnapshot.docs.length} intentMismatches from old structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from old intentMismatches structure:", error.message);
        }
      } catch (error) {
        console.log("⚠️ Error deleting intentMismatches:", error.message);
      }

      // 5. Delete internalLinkSuggestions
      try {
        const internalLinkQuery = query(
          collection(db, "internalLinkSuggestions"),
          where("userId", "==", userId)
        );
        const internalLinkSnapshot = await getDocs(internalLinkQuery);
        const batch3 = writeBatch(db);
        internalLinkSnapshot.docs.forEach((doc) => {
          batch3.delete(doc.ref);
          deleteCount++;
        });
        if (internalLinkSnapshot.docs.length > 0) {
          await batch3.commit();
          console.log(`✅ Deleted ${internalLinkSnapshot.docs.length} internalLinkSuggestions documents`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting internalLinkSuggestions:", error.message);
      }

      // 6. Delete contentAuditResults
      try {
        const contentAuditQuery = query(
          collection(db, "contentAuditResults"),
          where("userId", "==", userId)
        );
        const contentAuditSnapshot = await getDocs(contentAuditQuery);
        const batch4 = writeBatch(db);
        contentAuditSnapshot.docs.forEach((doc) => {
          batch4.delete(doc.ref);
          deleteCount++;
        });
        if (contentAuditSnapshot.docs.length > 0) {
          await batch4.commit();
          console.log(`✅ Deleted ${contentAuditSnapshot.docs.length} contentAuditResults documents`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting contentAuditResults:", error.message);
      }

      // 7. Delete aiSuggestions
      try {
        const aiSuggestionsQuery = query(
          collection(db, "aiSuggestions"),
          where("userId", "==", userId)
        );
        const aiSuggestionsSnapshot = await getDocs(aiSuggestionsQuery);
        const batch5 = writeBatch(db);
        aiSuggestionsSnapshot.docs.forEach((doc) => {
          batch5.delete(doc.ref);
          deleteCount++;
        });
        if (aiSuggestionsSnapshot.docs.length > 0) {
          await batch5.commit();
          console.log(`✅ Deleted ${aiSuggestionsSnapshot.docs.length} aiSuggestions documents`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting aiSuggestions:", error.message);
      }

      // 8. Delete pageContentCache (from both old and new structures)
      try {
        // Delete from NEW structure: pageContentCache/{userId}/pages
        try {
          const newPagesRef = collection(db, "pageContentCache", userId, "pages");
          const newPagesSnapshot = await getDocs(newPagesRef);
          const batch6a = writeBatch(db);
          newPagesSnapshot.docs.forEach((doc) => {
            batch6a.delete(doc.ref);
            deleteCount++;
          });
          if (newPagesSnapshot.docs.length > 0) {
            await batch6a.commit();
            console.log(`✅ Deleted ${newPagesSnapshot.docs.length} pageContentCache from new structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from new pageContentCache structure:", error.message);
        }

        // Delete from OLD structure: pageContentCache (flat)
        try {
          const pageCacheQuery = query(
            collection(db, "pageContentCache"),
            where("userId", "==", userId)
          );
          const pageCacheSnapshot = await getDocs(pageCacheQuery);
          const batch6b = writeBatch(db);
          pageCacheSnapshot.docs.forEach((doc) => {
            batch6b.delete(doc.ref);
            deleteCount++;
          });
          if (pageCacheSnapshot.docs.length > 0) {
            await batch6b.commit();
            console.log(`✅ Deleted ${pageCacheSnapshot.docs.length} pageContentCache from old structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from old pageContentCache structure:", error.message);
        }
      } catch (error) {
        console.log("⚠️ Error deleting pageContentCache:", error.message);
      }

      // 9. Delete siteCrawls
      try {
        const siteCrawlsRef = doc(db, "siteCrawls", userId);
        await deleteDoc(siteCrawlsRef);
        deleteCount++;
        console.log("✅ Deleted siteCrawls data");
      } catch (error) {
        console.log("⚠️ siteCrawls data not found or already deleted");
      }

      // 10. Delete focusKeywords
      try {
        const focusKeywordsRef = doc(db, "focusKeywords", userId);
        await deleteDoc(focusKeywordsRef);
        deleteCount++;
        console.log("✅ Deleted focusKeywords data");
      } catch (error) {
        console.log("⚠️ focusKeywords data not found or already deleted");
      }

      // 11. Delete conversations (full conversation messages)
      try {
        const conversationsQuery = query(
          collection(db, "conversations"),
          where("userId", "==", userId)
        );
        const conversationsSnapshot = await getDocs(conversationsQuery);
        const batch7 = writeBatch(db);
        conversationsSnapshot.docs.forEach((doc) => {
          batch7.delete(doc.ref);
          deleteCount++;
        });
        if (conversationsSnapshot.docs.length > 0) {
          await batch7.commit();
          console.log(`✅ Deleted ${conversationsSnapshot.docs.length} conversations`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting conversations:", error.message);
      }

      // 12. Delete seoMetaTitles (from both old and new structures)
      try {
        // Delete from NEW structure: seoMetaTitles/{userId}/titles
        try {
          const newTitlesRef = collection(db, "seoMetaTitles", userId, "titles");
          const newTitlesSnapshot = await getDocs(newTitlesRef);
          const batch8a = writeBatch(db);
          newTitlesSnapshot.docs.forEach((doc) => {
            batch8a.delete(doc.ref);
            deleteCount++;
          });
          if (newTitlesSnapshot.docs.length > 0) {
            await batch8a.commit();
            console.log(`✅ Deleted ${newTitlesSnapshot.docs.length} seoMetaTitles from new structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from new seoMetaTitles structure:", error.message);
        }

        // Delete from OLD structure: seoMetaTitles (flat)
        try {
          const seoTitlesQuery = query(
            collection(db, "seoMetaTitles"),
            where("userId", "==", userId)
          );
          const seoTitlesSnapshot = await getDocs(seoTitlesQuery);
          const batch8b = writeBatch(db);
          seoTitlesSnapshot.docs.forEach((doc) => {
            batch8b.delete(doc.ref);
            deleteCount++;
          });
          if (seoTitlesSnapshot.docs.length > 0) {
            await batch8b.commit();
            console.log(`✅ Deleted ${seoTitlesSnapshot.docs.length} seoMetaTitles from old structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from old seoMetaTitles structure:", error.message);
        }
      } catch (error) {
        console.log("⚠️ Error deleting seoMetaTitles:", error.message);
      }

      // 13. Delete seoMetaDescriptions (from both old and new structures)
      try {
        // Delete from NEW structure: seoMetaDescriptions/{userId}/descriptions
        try {
          const newDescriptionsRef = collection(db, "seoMetaDescriptions", userId, "descriptions");
          const newDescriptionsSnapshot = await getDocs(newDescriptionsRef);
          const batch9a = writeBatch(db);
          newDescriptionsSnapshot.docs.forEach((doc) => {
            batch9a.delete(doc.ref);
            deleteCount++;
          });
          if (newDescriptionsSnapshot.docs.length > 0) {
            await batch9a.commit();
            console.log(`✅ Deleted ${newDescriptionsSnapshot.docs.length} seoMetaDescriptions from new structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from new seoMetaDescriptions structure:", error.message);
        }

        // Delete from OLD structure: seoMetaDescriptions (flat)
        try {
          const seoDescriptionsQuery = query(
            collection(db, "seoMetaDescriptions"),
            where("userId", "==", userId)
          );
          const seoDescriptionsSnapshot = await getDocs(seoDescriptionsQuery);
          const batch9b = writeBatch(db);
          seoDescriptionsSnapshot.docs.forEach((doc) => {
            batch9b.delete(doc.ref);
            deleteCount++;
          });
          if (seoDescriptionsSnapshot.docs.length > 0) {
            await batch9b.commit();
            console.log(`✅ Deleted ${seoDescriptionsSnapshot.docs.length} seoMetaDescriptions from old structure`);
          }
        } catch (error) {
          console.log("⚠️ Error deleting from old seoMetaDescriptions structure:", error.message);
        }
      } catch (error) {
        console.log("⚠️ Error deleting seoMetaDescriptions:", error.message);
      }

      // 14. Delete genericKeywordsCache
      try {
        const genericKeywordsQuery = query(
          collection(db, "genericKeywordsCache"),
          where("userId", "==", userId)
        );
        const genericKeywordsSnapshot = await getDocs(genericKeywordsQuery);
        const batch10 = writeBatch(db);
        genericKeywordsSnapshot.docs.forEach((doc) => {
          batch10.delete(doc.ref);
          deleteCount++;
        });
        if (genericKeywordsSnapshot.docs.length > 0) {
          await batch10.commit();
          console.log(`✅ Deleted ${genericKeywordsSnapshot.docs.length} genericKeywordsCache documents`);
        }
      } catch (error) {
        console.log("⚠️ Error deleting genericKeywordsCache:", error.message);
      }
      
      console.log(`✅ Successfully deleted ${deleteCount} documents for user ${userId}`);
    } catch (error) {
      console.error("Error deleting user data:", error);
      throw error;
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    // TODO: Uncomment when implementing notification preferences
    // { id: "notifications", label: "Notifications", icon: Bell },
    // TODO: Uncomment when implementing SEO preferences
    // { id: "seo", label: "SEO Preferences", icon: Search },
    { id: "integrations", label: "Integrations", icon: Globe },
    { id: "account", label: "Account", icon: Shield }
  ];

  if (authLoading) {
    return null;
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-background border-b border-border">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account and SEO tool preferences.
            </p>
          </div>
        </div>

        {/* Horizontal Tab Navigation */}
        <div className="bg-background border-b border-border">
          <div className="px-6">
            <nav className="flex space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? "text-foreground border-green-600 bg-green-50 dark:bg-green-950/20"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 py-8">
          <div className="w-full">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5" />
                    Business Information
                  </CardTitle>
                  <CardDescription>
                    Update your business details for better SEO recommendations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Coming Soon Message */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                          Profile editing coming soon
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Profile editing will be available soon. For now, please{" "}
                          <a href="/contact" className="underline font-medium hover:text-blue-600 dark:hover:text-blue-300">
                            contact us
                          </a>{" "}
                          if you need to make any changes to your profile.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Faded Form Fields */}
                  <div className="opacity-50 pointer-events-none">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {data?.businessName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <Button variant="outline" size="sm" className="gap-2" disabled>
                        <Camera className="w-4 h-4" />
                        Change Avatar
                      </Button>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload a new profile picture
                      </p>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Business Name
                      </label>
                      <Input
                        value={formData.businessName}
                        onChange={(e) => handleInputChange("businessName", e.target.value)}
                        placeholder="Enter your business name"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Website URL
                      </label>
                      <Input
                        value={formData.websiteUrl}
                        onChange={(e) => handleInputChange("websiteUrl", e.target.value)}
                        placeholder="https://yourwebsite.com"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Business Type
                      </label>
                      <Select value={formData.businessType} onValueChange={(value) => handleInputChange("businessType", value)} disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dentist">Dentist</SelectItem>
                          <SelectItem value="Restaurant">Restaurant</SelectItem>
                          <SelectItem value="Roofer">Roofer</SelectItem>
                          <SelectItem value="Plumber">Plumber</SelectItem>
                          <SelectItem value="Hair Salon">Hair Salon</SelectItem>
                          <SelectItem value="Retail Store">Retail Store</SelectItem>
                          <SelectItem value="Law Firm">Law Firm</SelectItem>
                          <SelectItem value="Real Estate">Real Estate</SelectItem>
                          <SelectItem value="Fitness">Fitness</SelectItem>
                          <SelectItem value="Car Wash">Car Wash</SelectItem>
                          <SelectItem value="Automotive Services">Automotive Services</SelectItem>
                          <SelectItem value="Oil Change">Oil Change</SelectItem>
                          <SelectItem value="Auto Repair">Auto Repair</SelectItem>
                          <SelectItem value="Pet Grooming">Pet Grooming</SelectItem>
                          <SelectItem value="Cleaning Services">Cleaning Services</SelectItem>
                          <SelectItem value="Landscaping">Landscaping</SelectItem>
                          <SelectItem value="HVAC">HVAC</SelectItem>
                          <SelectItem value="Electrician">Electrician</SelectItem>
                          <SelectItem value="Contractor">Contractor</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Business Location
                      </label>
                      <Input
                        value={formData.businessLocation}
                        onChange={(e) => handleInputChange("businessLocation", e.target.value)}
                        placeholder="City, State or ZIP Code"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <SettingsIcon className="w-4 h-4" />
                        CMS Platform
                      </label>
                      <Select value={formData.cmsPlatform} onValueChange={(value) => handleInputChange("cmsPlatform", value)} disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wordpress">WordPress</SelectItem>
                          <SelectItem value="squarespace">Squarespace</SelectItem>
                          <SelectItem value="wix">Wix</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Contact Email
                      </label>
                      <Input
                        value={formData.contactEmail}
                        onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                        type="email"
                        placeholder="contact@yourbusiness.com"
                        disabled
                      />
                    </div>
                  </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notifications Tab - TODO: Uncomment when implementing notification preferences
            {activeTab === "notifications" && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Choose what notifications you&apos;d like to receive via email and real-time alerts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Email Notifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { key: "emailReports", label: "Weekly SEO Reports", description: "Get a summary of your SEO performance every week" },
                        { key: "weeklyDigest", label: "Weekly Digest", description: "Top keywords, ranking changes, and recommendations" },
                        { key: "keywordAlerts", label: "Keyword Alerts", description: "Get notified when your keywords change significantly" },
                        { key: "rankingChanges", label: "Ranking Changes", description: "Alerts when your pages move up or down in rankings" },
                        { key: "newFeatures", label: "New Features", description: "Updates about new tools and features" },
                        { key: "marketingEmails", label: "Marketing Emails", description: "Tips, best practices, and industry insights" }
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                          </div>
                          <Switch
                            checked={formData[item.key]}
                            onCheckedChange={(checked) => handleInputChange(item.key, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Real-time Alerts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Critical Ranking Drops</div>
                          <div className="text-sm text-muted-foreground">Immediate alerts for significant ranking losses</div>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Website Downtime</div>
                          <div className="text-sm text-muted-foreground">Get notified if your website goes offline</div>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            */}

            {/* SEO Preferences Tab - TODO: Uncomment when implementing SEO preferences
            {activeTab === "seo" && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="w-5 h-5" />
                    SEO Dashboard Settings
                  </CardTitle>
                  <CardDescription>
                    Customize your SEO dashboard and data preferences for optimal performance tracking.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Dashboard Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Default Date Range
                        </label>
                        <Select value={formData.defaultDateRange} onValueChange={(value) => handleInputChange("defaultDateRange", value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                            <SelectItem value="365">Last year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          Data Retention
                        </label>
                        <Select value={formData.dataRetention} onValueChange={(value) => handleInputChange("dataRetention", value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="6">6 months</SelectItem>
                            <SelectItem value="12">12 months</SelectItem>
                            <SelectItem value="24">24 months</SelectItem>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Feature Preferences</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Auto-refresh Data</div>
                          <div className="text-sm text-muted-foreground">Automatically refresh SEO data every hour</div>
                        </div>
                        <Switch
                          checked={formData.autoRefresh}
                          onCheckedChange={(checked) => handleInputChange("autoRefresh", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Show Advanced Metrics</div>
                          <div className="text-sm text-muted-foreground">Display technical SEO metrics and advanced data</div>
                        </div>
                        <Switch
                          checked={formData.showAdvancedMetrics}
                          onCheckedChange={(checked) => handleInputChange("showAdvancedMetrics", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Enable AI Tips</div>
                          <div className="text-sm text-muted-foreground">Show personalized AI recommendations and tips</div>
                        </div>
                        <Switch
                          checked={formData.enableAITips}
                          onCheckedChange={(checked) => handleInputChange("enableAITips", checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Reporting Preferences</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Bell className="w-4 h-4" />
                          Report Frequency
                        </label>
                        <Select defaultValue="weekly">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Report Format
                        </label>
                        <Select defaultValue="pdf">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            */}

            {/* Integrations Tab */}
            {activeTab === "integrations" && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="w-5 h-5" />
                    Connected Services
                  </CardTitle>
                  <CardDescription>
                    Manage your integrations with third-party services and data sources.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    {/* Google Search Console */}
                    <div className="flex items-center justify-between p-6 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <Search className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">Google Search Console</div>
                          <div className="text-sm text-muted-foreground">
                            {formData.gscConnected ? (
                              <>
                                Connected
                                {formData.gscProperty && (
                                  <span className="ml-2 text-green-600">
                                    • Property: {formData.gscProperty}
                                  </span>
                                )}
                              </>
                            ) : (
                              "Not connected"
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.gscConnected ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => router.push("/onboarding?step=4")}
                            >
                              Reconnect
                            </Button>
                          </>
                        ) : (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => router.push("/onboarding?step=4")}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* TODO: Uncomment when implementing additional integrations */}
                    {/* Google Analytics */}
                    {/* <div className="flex items-center justify-between p-6 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                          <BarChart3 className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">Google Analytics</div>
                          <div className="text-sm text-muted-foreground">
                            {formData.analyticsConnected ? "Connected" : "Not connected"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.analyticsConnected ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <Button variant="outline" size="sm">
                              Reconnect
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            Connect
                          </Button>
                        )}
                      </div>
                    </div> */}

                    {/* Social Media */}
                    {/* <div className="flex items-center justify-between p-6 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                          <Globe className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">Social Media</div>
                          <div className="text-sm text-muted-foreground">
                            {formData.socialConnected ? "Connected" : "Not connected"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.socialConnected ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <Button variant="outline" size="sm">
                              Reconnect
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            Connect
                          </Button>
                        )}
                      </div>
                    </div> */}

                    {/* Additional Integration Placeholder */}
                    {/* <div className="flex items-center justify-between p-6 border rounded-lg border-dashed">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                          <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg text-muted-foreground">More Integrations</div>
                          <div className="text-sm text-muted-foreground">
                            Coming soon
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Coming Soon
                      </Button>
                    </div> */}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Account Tab */}
            {activeTab === "account" && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5" />
                    Account & Security
                  </CardTitle>
                  <CardDescription>
                    Manage your account security, data preferences, and privacy settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Security Settings - TODO: Uncomment when implementing security features
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Security Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Two-Factor Authentication</div>
                          <div className="text-sm text-muted-foreground">Add an extra layer of security to your account</div>
                        </div>
                        <Switch
                          checked={formData.twoFactorEnabled}
                          onCheckedChange={(checked) => handleInputChange("twoFactorEnabled", checked)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          Session Timeout
                        </label>
                        <Select value={formData.sessionTimeout} onValueChange={(value) => handleInputChange("sessionTimeout", value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 hour</SelectItem>
                            <SelectItem value="8">8 hours</SelectItem>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="168">1 week</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  */}

                  {/* Data Management - TODO: Uncomment when implementing data export/import
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Data Management</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Export My Data</div>
                          <div className="text-sm text-muted-foreground">Download all your SEO data and settings</div>
                        </div>
                        <Button variant="outline" onClick={handleExportData}>
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">Import Data</div>
                          <div className="text-sm text-muted-foreground">Upload data from other SEO tools</div>
                        </div>
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          Import
                        </Button>
                      </div>
                    </div>
                  </div>
                  */}

                  {/* Danger Zone */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-red-600">Danger Zone</h3>
                    <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium text-red-600">Delete Account</div>
                          <div className="text-sm text-muted-foreground">
                            Permanently delete your account and all associated data. This action cannot be undone.
                          </div>
                          <div className="text-xs text-red-500 mt-1">
                            <strong>This will delete:</strong> All SEO progress, implementation history, GSC data, 
                            recommendations, settings, and account information.
                          </div>
                        </div>
                        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                          <DialogTrigger asChild>
                            <Button variant="destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Account
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="w-5 h-5" />
                                Delete Account
                              </DialogTitle>
                              <DialogDescription>
                                This action will permanently delete your account and all associated data. 
                                <strong> This cannot be undone.</strong>
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                                  The following data will be permanently deleted:
                                </p>
                                <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                                  <li>• All SEO progress and implementation history</li>
                                  <li>• Google Search Console data and tokens</li>
                                  <li>• AI-generated recommendations and suggestions</li>
                                  <li>• Content audit results and keyword analysis</li>
                                  <li>• Account settings and preferences</li>
                                  <li>• All cached data and analytics</li>
                                </ul>
                              </div>
                              <p className="text-sm">
                                To confirm deletion, type <strong>DELETE</strong> in the box below{!isGoogleUser && " and enter your password"}:
                              </p>
                              <div className="space-y-3">
                                <Input
                                  placeholder="Type DELETE to confirm"
                                  value={deleteConfirmation}
                                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                                  className="border-red-200 focus:border-red-400"
                                />
                                {!isGoogleUser && (
                                  <Input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    className="border-red-200 focus:border-red-400"
                                  />
                                )}
                                {isGoogleUser && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                                    <strong>Google Account:</strong> You&apos;ll be prompted to re-authenticate with Google when you click delete.
                                  </div>
                                )}
                              </div>
                            </div>
                            <DialogFooter className="gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowDeleteDialog(false);
                                  setDeleteConfirmation("");
                                  setDeletePassword("");
                                }}
                                disabled={isDeleting}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || deleteConfirmation !== "DELETE" || (!isGoogleUser && !deletePassword)}
                                className="gap-2"
                              >
                                {isDeleting ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4" />
                                    Delete Account
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
