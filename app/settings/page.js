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
import { deleteUser } from "firebase/auth";

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
    gscConnected: true,
    gscLastSync: "2024-01-15T10:30:00Z",
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

  useEffect(() => {
    if (typeof window !== "undefined" && !authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Load user data
  useEffect(() => {
    if (data) {
      setFormData(prev => ({
        ...prev,
        businessName: data.businessName || "",
        websiteUrl: data.websiteUrl || "",
        businessType: data.businessType || "",
        businessLocation: data.businessLocation || "",
        cmsPlatform: data.cmsPlatform || "",
        contactEmail: user?.email || ""
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
      // Delete all user data from Firestore
      await deleteAllUserData(user.id);
      
      // Delete the Firebase Auth user
      const { auth } = await import("../lib/firebaseConfig");
      await deleteUser(auth.currentUser);
      
      toast.success("Account deleted successfully", {
        description: "All your data has been permanently removed."
      });
      
      // Redirect to home page
      router.push("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account", {
        description: error.message || "Please try again or contact support."
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmation("");
    }
  };

  const deleteAllUserData = async (userId) => {
    const batch = writeBatch(db);
    let deleteCount = 0;

    try {
      // 1. Delete onboarding data
      const onboardingRef = doc(db, "onboarding", userId);
      batch.delete(onboardingRef);
      deleteCount++;

      // 2. Delete user profile data
      const userRef = doc(db, "users", userId);
      batch.delete(userRef);
      deleteCount++;

      // 3. Delete implementedSeoTips (query by userId field)
      const implementedSeoTipsQuery = query(
        collection(db, "implementedSeoTips"),
        where("userId", "==", userId)
      );
      const implementedSeoTipsSnapshot = await getDocs(implementedSeoTipsQuery);
      implementedSeoTipsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // 4. Delete intentMismatches
      const intentMismatchesQuery = query(
        collection(db, "intentMismatches"),
        where("userId", "==", userId)
      );
      const intentMismatchesSnapshot = await getDocs(intentMismatchesQuery);
      intentMismatchesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // 5. Delete internalLinkSuggestions (documents with userId prefix)
      const internalLinkQuery = query(
        collection(db, "internalLinkSuggestions"),
        where("userId", "==", userId)
      );
      const internalLinkSnapshot = await getDocs(internalLinkQuery);
      internalLinkSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // 6. Delete contentAuditResults (documents with userId prefix)
      const contentAuditQuery = query(
        collection(db, "contentAuditResults"),
        where("userId", "==", userId)
      );
      const contentAuditSnapshot = await getDocs(contentAuditQuery);
      contentAuditSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // 7. Delete aiSuggestions (documents with userId prefix)
      const aiSuggestionsQuery = query(
        collection(db, "aiSuggestions"),
        where("userId", "==", userId)
      );
      const aiSuggestionsSnapshot = await getDocs(aiSuggestionsQuery);
      aiSuggestionsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // 8. Delete pageContentCache (documents with userId prefix)
      const pageCacheQuery = query(
        collection(db, "pageContentCache"),
        where("userId", "==", userId)
      );
      const pageCacheSnapshot = await getDocs(pageCacheQuery);
      pageCacheSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Execute the batch delete
      await batch.commit();
      
      console.log(`✅ Deleted ${deleteCount} documents for user ${userId}`);
    } catch (error) {
      console.error("Error deleting user data:", error);
      throw error;
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "seo", label: "SEO Preferences", icon: Search },
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
                  {/* Avatar Section */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {data?.businessName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <Button variant="outline" size="sm" className="gap-2">
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
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Business Type
                      </label>
                      <Select value={formData.businessType} onValueChange={(value) => handleInputChange("businessType", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ecommerce">E-commerce</SelectItem>
                          <SelectItem value="service">Service Business</SelectItem>
                          <SelectItem value="blog">Blog/Content</SelectItem>
                          <SelectItem value="saas">SaaS</SelectItem>
                          <SelectItem value="local">Local Business</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
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
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <SettingsIcon className="w-4 h-4" />
                        CMS Platform
                      </label>
                      <Select value={formData.cmsPlatform} onValueChange={(value) => handleInputChange("cmsPlatform", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wordpress">WordPress</SelectItem>
                          <SelectItem value="shopify">Shopify</SelectItem>
                          <SelectItem value="squarespace">Squarespace</SelectItem>
                          <SelectItem value="wix">Wix</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
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
                      />
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

            {/* Notifications Tab */}
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
                  {/* Email Notifications */}
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

                  {/* Real-time Alerts */}
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

            {/* SEO Preferences Tab */}
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
                  {/* Dashboard Settings */}
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

                  {/* Feature Toggles */}
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

                  {/* Reporting Settings */}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Google Search Console */}
                    <div className="flex items-center justify-between p-6 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <Search className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">Google Search Console</div>
                          <div className="text-sm text-muted-foreground">
                            {formData.gscConnected ? "Connected" : "Not connected"}
                            {formData.gscConnected && (
                              <span className="ml-2 text-green-600">
                                • Last sync: {new Date(formData.gscLastSync).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.gscConnected ? (
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
                    </div>

                    {/* Google Analytics */}
                    <div className="flex items-center justify-between p-6 border rounded-lg">
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
                    </div>

                    {/* Social Media */}
                    <div className="flex items-center justify-between p-6 border rounded-lg">
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
                    </div>

                    {/* Additional Integration Placeholder */}
                    <div className="flex items-center justify-between p-6 border rounded-lg border-dashed">
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
                  {/* Security Settings */}
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

                  {/* Data Management */}
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
                                To confirm deletion, type <strong>DELETE</strong> in the box below:
                              </p>
                              <Input
                                placeholder="Type DELETE to confirm"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                className="border-red-200 focus:border-red-400"
                              />
                            </div>
                            <DialogFooter className="gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowDeleteDialog(false);
                                  setDeleteConfirmation("");
                                }}
                                disabled={isDeleting}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || deleteConfirmation !== "DELETE"}
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
