"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  Computer,
  CheckCircle,
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
  "Other",
];

const cmsPlatforms = [
  "WordPress",
  "Shopify",
  "Wix",
  "Squarespace",
  "Webflow",
  "Custom",
  "Other",
          "I don&apos;t know",
];

const OnboardingWizard = () => {
  const { data, updateData } = useOnboarding();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user && data.isComplete) {
      router.push("/dashboard");
    }
  }, [user, isLoading, data.isComplete]);

  const totalSteps = 5;

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
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
      updateData({ isComplete: true });
      router.push("/dashboard");
      setIsSubmitting(false);
    }, 1000);
  };

  const getProgressPercent = () => {
    return (currentStep / totalSteps) * 100;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
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

        <Card className="shadow-md">
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
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Bryan"
                    value={data.name || ""}
                    onChange={(e) => updateData({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    placeholder="Acme Inc."
                    value={data.businessName}
                    onChange={(e) =>
                      updateData({ businessName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
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
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="text-primary" />
                  <h2 className="text-xl font-semibold">Website Information</h2>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL</Label>
                  <Input
                    id="websiteUrl"
                    placeholder="https://example.com"
                    value={data.websiteUrl}
                    onChange={(e) => updateData({ websiteUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cmsPlatform">Website Platform</Label>
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
                  <Label htmlFor="businessLocation">Business Location</Label>
                  <Input
                    id="businessLocation"
                    placeholder="City, State or ZIP Code"
                    value={data.businessLocation}
                    onChange={(e) =>
                      updateData({ businessLocation: e.target.value })
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  This helps us optimize your local SEO strategy
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
                      Do you have Google Search Console set up?
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
                        <strong>Note:</strong> Only toggle &quot;Yes&quot; if you&apos;re certain you have GSC set up. You can always set it up later!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="text-primary" />
                  <h2 className="text-xl font-semibold">All Set!</h2>
                </div>
                <div className="py-4 text-center">
                  <div className="bg-primary/10 text-primary p-3 rounded-lg inline-flex items-center mb-4">
                    <CheckCircle className="h-6 w-6 mr-2" />
                    <span className="font-medium">Setup Complete</span>
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    Ready to boost your SEO
                  </h3>
                  <p className="text-muted-foreground">
                    We&apos;ve gathered everything we need to help optimize your
                    website&apos;s performance.
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between pt-2">
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
              <Button onClick={nextStep}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submitOnboarding} disabled={isSubmitting}>
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
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingWizard;
