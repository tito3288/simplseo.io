"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  Computer,
  CheckCircle,
  FileText,
} from "lucide-react";

const businessTypes = [
  "Dentist",
  "Restaurant",
  "Roofer",
  "Plumber",
  "Hair Salon",
  "Retail Store",
  "Law Firm",
  "Real Estate",
  "Fitness",
  "Car Wash",
  "Automotive Services",
  "Oil Change",
  "Auto Repair",
  "Pet Grooming",
  "Cleaning Services",
  "Landscaping",
  "HVAC",
  "Electrician",
  "Contractor",
  "Other",
];

const cmsPlatforms = [
  "WordPress",
  "Wix",
  "Squarespace",
];

const OnboardingWizard = () => {
  const { data, updateData } = useOnboarding();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gscProperties, setGscProperties] = useState([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  const [googleRefreshToken, setGoogleRefreshToken] = useState(null);
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user && data.isComplete) {
      router.push("/dashboard");
    }
  }, [user, isLoading, data.isComplete, router]);

  const totalSteps = 5;

  const nextStep = () => {
    if (currentStep < totalSteps && isStepValid()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        // If "Other" is selected, customBusinessType is required
        if (data.businessType === "Other") {
          return data.name && data.businessName && data.businessType && data.customBusinessType;
        }
        return data.name && data.businessName && data.businessType;
      case 2:
        return data.websiteUrl && data.cmsPlatform;
      case 3:
        return data.businessLocation;
      case 4:
        // GSC is mandatory - user must toggle "Yes" AND connect/select a property
        return data.hasGSC && data.gscProperty;
      case 5:
        // Privacy policy must be accepted
        return data.privacyPolicyAccepted === true;
      default:
        return false;
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const submitOnboarding = () => {
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      updateData({ 
        isComplete: true,
        postOnboardingStep: 'pages', // Start post-onboarding flow with pages step
        pagesStepCompleted: false
      });
      router.push("/dashboard");
      setIsSubmitting(false);
    }, 1000);
  };

  const getProgressPercent = () => {
    return (currentStep / totalSteps) * 100;
  };

  // Handle Google OAuth
  const handleGoogleAuth = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "956212275866-7dtgdq7b38b156riehghuvh8b8469ktg.apps.googleusercontent.com";
    const redirectUri = `${window.location.origin}/api/auth/google/callback`;
    const scope = 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/userinfo.email';
    
    // Debug logging
    console.log('Google OAuth Debug:', {
      clientId,
      redirectUri,
      scope,
      origin: window.location.origin
    });
    
    if (!clientId) {
      alert('Google Client ID not found. Please check your environment variables.');
      return;
    }
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('Auth URL:', authUrl);
    window.location.href = authUrl;
  };

  // Fetch GSC properties
  const fetchGscProperties = useCallback(async (accessToken) => {
    setIsLoadingProperties(true);
    try {
      const response = await fetch(`/api/gsc/properties?accessToken=${accessToken}`);
      const result = await response.json();
      
      if (result.success) {
        setGscProperties(result.properties);
      } else {
        console.error("Failed to fetch GSC properties:", result.error);
      }
    } catch (error) {
      console.error("Error fetching GSC properties:", error);
    } finally {
      setIsLoadingProperties(false);
    }
  }, []);

  // Check for Google OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const email = urlParams.get('email');
    const step = urlParams.get('step');
    
    console.log("🔍 OAuth callback tokens:", {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      email: email,
      step: step
    });
    
    if (accessToken && email) {
      setGoogleAccessToken(accessToken);
      if (refreshToken) {
        setGoogleRefreshToken(refreshToken);
      }
      updateData({ googleEmail: email });
      fetchGscProperties(accessToken);
      
      // Set the step if provided (for OAuth callback)
      if (step) {
        setCurrentStep(parseInt(step));
      }
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [updateData, fetchGscProperties]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Orbs - Full Width, Fixed to Viewport */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-40 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-3000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Set Up Your SEO Coach</h1>
          <p className="text-muted-foreground mt-2">
            Let&apos;s get started with your onboarding process.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mb-8">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${getProgressPercent()}%` }}
          ></div>
        </div>

        <Card className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl shadow-2xl">
          <CardContent className="pt-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="text-primary" />
                  <h2 className="text-xl font-semibold">
                    Business Information
                  </h2>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    placeholder="e.g. Bryan Arambula"
                    value={data.name || ""}
                    onChange={(e) => updateData({ name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="businessName"
                    placeholder="Acme Inc."
                    value={data.businessName}
                    onChange={(e) =>
                      updateData({ businessName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={data.businessType}
                    onValueChange={(value) =>
                      updateData({ businessType: value })
                    }
                  >
                    <SelectTrigger id="businessType">
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Custom business type input when "Other" is selected */}
                {data.businessType === "Other" && (
                  <div className="space-y-2">
                    <Label htmlFor="customBusinessType">Please specify your business type <span className="text-red-500">*</span></Label>
                    <Input
                      id="customBusinessType"
                      placeholder="e.g. Car Wash, Pet Grooming, Landscaping"
                      value={data.customBusinessType || ""}
                      onChange={(e) =>
                        updateData({ customBusinessType: e.target.value })
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      This helps us provide better SEO recommendations for your specific business.
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  <span className="text-red-500">*</span> All fields are required to continue
                </p>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="text-primary" />
                  <h2 className="text-xl font-semibold">Website Information</h2>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL <span className="text-red-500">*</span></Label>
                  <Input
                    id="websiteUrl"
                    placeholder="https://example.com"
                    value={data.websiteUrl}
                    onChange={(e) => updateData({ websiteUrl: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cmsPlatform">Website Platform <span className="text-red-500">*</span></Label>
                  <Select
                    value={data.cmsPlatform}
                    onValueChange={(value) =>
                      updateData({ cmsPlatform: value })
                    }
                  >
                    <SelectTrigger id="cmsPlatform">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {cmsPlatforms.map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  <span className="text-red-500">*</span> All fields are required to continue
                </p>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="text-primary" />
                  <h2 className="text-xl font-semibold">
                    Location Information
                  </h2>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessLocation">Business Location <span className="text-red-500">*</span></Label>
                  <Input
                    id="businessLocation"
                    placeholder="e.g. Seattle, WA"
                    value={data.businessLocation}
                    onChange={(e) =>
                      updateData({ businessLocation: e.target.value })
                    }
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  This helps us optimize your local SEO strategy
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  <span className="text-red-500">*</span> All fields are required to continue
                </p>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Computer className="text-primary" />
                  <h2 className="text-xl font-semibold">Analytics Setup</h2>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="hasGSC">
                      Do you have Google Search Console set up? <br></br> If &quot;YES&quot; please toggle. If &quot;NO&quot; follow steps below.
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      <strong>Important:</strong> Google Search Console is required to track your search performance and provide SEO insights
                    </p>
                  </div>
                  <Switch
                    id="hasGSC"
                    checked={data.hasGSC}
                    onCheckedChange={(checked) =>
                      updateData({ hasGSC: checked })
                    }
                  />
                </div>

                {!data.hasGSC && (
                  <div className="bg-muted p-3 rounded-md mt-4">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        <strong>Required Setup:</strong> You&apos;ll need to set up Google Search Console first:
                      </p>
                      <ol className="text-sm text-muted-foreground space-y-2 ml-4">
                        <li>1. Go to <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Search Console</a></li>
                        <li>2. Add your property: <code className="bg-background px-1 rounded">{data.websiteUrl || "your-website.com"}</code></li>
                        <li>3. Verify ownership (DNS record or HTML file)</li>
                        <li>4. Come back and connect your account</li>
                      </ol>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Note:</strong> Google Search Console is required to continue. Please complete the setup steps above, then return to toggle &quot;Yes&quot; and connect your account.
                      </p>
                    </div>
                  </div>
                )}

                {data.hasGSC && (
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="gscProperty">Select GSC Property</Label>
                      <Select
                        value={data.gscProperty || ""}
                        onValueChange={async (value) => {
                          if (value === "connect") {
                            handleGoogleAuth();
                          } else {
                            console.log("🎯 GSC Property selected:", value);
                            updateData({ gscProperty: value });
                            console.log("✅ GSC Property saved to context");
                            
                            // Store the Google tokens in Firestore for the selected property
                            if (googleAccessToken && user?.id) {
                              try {
                                console.log("💾 Storing Google tokens for property:", value);
                                const response = await fetch('/api/gsc/exchange-code', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    accessToken: googleAccessToken,
                                    refreshToken: googleRefreshToken,
                                    property: value,
                                    userId: user.id
                                  })
                                });
                                
                                if (response.ok) {
                                  console.log("✅ Google tokens stored successfully");
                                } else {
                                  console.error("❌ Failed to store Google tokens");
                                }
                              } catch (error) {
                                console.error("❌ Error storing Google tokens:", error);
                              }
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="gscProperty">
                          <SelectValue placeholder={
                            googleAccessToken 
                              ? (isLoadingProperties ? "Loading properties..." : "Select a property")
                              : "Connect your Google account to see properties"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {!googleAccessToken ? (
                            <SelectItem value="connect">
                              <div className="flex items-center gap-2">
                                <span>🔗 Connect Google Account</span>
                              </div>
                            </SelectItem>
                          ) : (
                            <>
                              {isLoadingProperties ? (
                                <SelectItem value="loading" disabled>
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                                    <span>Loading properties...</span>
                                  </div>
                                </SelectItem>
                              ) : gscProperties.length > 0 ? (
                                gscProperties.map((property) => (
                                  <SelectItem key={property.siteUrl} value={property.siteUrl}>
                                    <div className="flex items-center gap-2">
                                      <span>{property.siteUrl}</span>
                                      {property.verified && (
                                        <span className="text-green-500 text-xs">✓</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-properties" disabled>
                                  <div className="flex items-center gap-2">
                                    <span>No GSC properties found</span>
                                  </div>
                                </SelectItem>
                              )}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This property will be used for SEO tracking and insights.
                    </p>
                    {googleAccessToken && gscProperties.length === 0 && !isLoadingProperties && (
                      <p className="text-sm text-amber-600">
                        No verified GSC properties found. Make sure you have verified ownership of your website in Google Search Console.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="text-primary" />
                  <h2 className="text-xl font-semibold">Privacy Policy & Terms</h2>
                </div>
                
                {/* Scrollable Privacy Policy */}
                <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto bg-muted/50">
                  <div className="space-y-3 text-sm">
                    <h3 className="font-semibold text-base">Data Collection for Training Purposes</h3>
                    <p>
                      We collect anonymized data to improve our SEO services and train our AI models. 
                      This includes:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Meta title and description generation patterns</li>
                      <li>Successful SEO strategies (anonymized)</li>
                      <li>Conversation summaries (not full conversations)</li>
                    </ul>
                    <p className="font-semibold mt-4">Privacy & Security:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>User IDs are hashed using SHA-256</li>
                      <li>Full URLs are anonymized (only page paths stored)</li>
                      <li>Business names are not stored in training data</li>
                      <li>Full conversations are not stored - only summaries</li>
                      <li>All data collection is server-side only</li>
                    </ul>
                    <p className="mt-4">
                      By continuing, you agree to our data collection practices for training and 
                      service improvement purposes.
                    </p>
                  </div>
                </div>
                
                {/* Checkbox */}
                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="privacyPolicy"
                    checked={data.privacyPolicyAccepted || false}
                    onCheckedChange={(checked) => 
                      updateData({ privacyPolicyAccepted: checked === true })
                    }
                  />
                  <label 
                    htmlFor="privacyPolicy" 
                    className="text-sm cursor-pointer leading-5"
                  >
                    I have read and agree to the Privacy Policy and data collection terms
                  </label>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <div className="flex justify-between w-full">
            {currentStep > 1 ? (
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : (
              <div></div>
            )}

            {currentStep < totalSteps ? (
                <Button onClick={nextStep} disabled={!isStepValid()}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            ) : (
              <Button onClick={submitOnboarding} disabled={isSubmitting || !isStepValid()}>
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing
                  </span>
                ) : (
                  <>
                    Continue to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              )}
            </div>
            
            {!isStepValid() && (
              <p className="text-xs text-muted-foreground text-center w-full">
                {currentStep === 4 
                  ? "Please connect your Google Search Console account to continue"
                  : currentStep === 5
                  ? "Please read and accept the Privacy Policy to continue"
                  : "Please fill in all required fields"}
              </p>
            )}
          </CardFooter>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
