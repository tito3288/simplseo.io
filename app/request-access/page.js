"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "../components/MainLayout";
import { isAccessRequestEnabled } from "../lib/accessRequestConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Send, CheckCircle } from "lucide-react";

export default function RequestAccessPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    company: "",
    reason: "",
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!formData.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/access-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit request");
      }

      const result = await response.json();
      
      if (result.success) {
        setIsSubmitted(true);
        toast.success("Request submitted successfully!", {
          description: "We'll review your request and send you an invitation code via email if approved.",
        });
      }
    } catch (error) {
      console.error("Error submitting access request:", error);
      toast.error("Failed to submit request", {
        description: "Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect to auth if access request is disabled
  useEffect(() => {
    if (!isAccessRequestEnabled()) {
      router.push("/auth");
      return;
    }

    // Check if user is already approved
    const checkApproval = async () => {
      const storedEmail = localStorage.getItem("approvedEmail");
      if (storedEmail) {
        try {
          const response = await fetch(`/api/check-approval?email=${encodeURIComponent(storedEmail)}`);
          const data = await response.json();
          if (data.approved) {
            router.push("/auth");
          }
        } catch (error) {
          console.error("Error checking approval:", error);
        }
      }
    };
    checkApproval();
  }, [router]);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Animated Background Orbs - Full Width, Fixed to Viewport */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
          <div className="absolute bottom-40 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-3000"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 px-6 py-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
            Request Access
          </h1>
          <p className="text-lg text-muted-foreground">
            SimplSEO is currently in private beta. Request access to get started.
          </p>
        </div>

        {/* Main Content */}
        <div className="relative z-10 px-6 pb-12 max-w-2xl mx-auto">
          {isSubmitted ? (
            <Card className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl shadow-2xl">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="bg-green-500/20 inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
                  <p className="text-muted-foreground mb-4">
                    We&apos;ve received your access request. We&apos;ll review it and send you an invitation code via email if approved.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Check your email ({formData.email}) for updates.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl shadow-2xl">
              <CardHeader>
                <CardTitle>Request Access to SimplSEO</CardTitle>
                <CardDescription>
                  Tell us a bit about yourself and why you&apos;d like to use SimplSEO.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="your.email@example.com"
                      required
                      className="bg-white/5 border-white/10 backdrop-blur-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Your name"
                      className="bg-white/5 border-white/10 backdrop-blur-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company / Business</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => handleInputChange("company", e.target.value)}
                      placeholder="Your company or business name"
                      className="bg-white/5 border-white/10 backdrop-blur-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Why do you want access? (Optional)</Label>
                    <Textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => handleInputChange("reason", e.target.value)}
                      placeholder="Tell us about your business and how SimplSEO can help..."
                      rows={4}
                      className="bg-white/5 border-white/10 backdrop-blur-sm resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Request
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

