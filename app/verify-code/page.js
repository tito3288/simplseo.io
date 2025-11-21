"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "../components/MainLayout";
import { isAccessRequestEnabled } from "../lib/accessRequestConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Key, CheckCircle, ArrowRight } from "lucide-react";

export default function VerifyCodePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Redirect to auth if access request is disabled
  useEffect(() => {
    if (!isAccessRequestEnabled()) {
      router.push("/auth");
      return;
    }

    // Check if code is in URL params (from email link)
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setCode(codeParam);
    }
  }, [searchParams, router]);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!code.trim()) {
      toast.error("Please enter your invitation code");
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch("/api/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid code");
      }

      const result = await response.json();
      
      if (result.success) {
        // Store approved email in localStorage
        localStorage.setItem("approvedEmail", result.email);
        
        setIsVerified(true);
        setUserEmail(result.email);
        
        toast.success("Code verified successfully!", {
          description: "You now have access to SimplSEO. Redirecting to login...",
        });

        // Redirect to auth page after 2 seconds
        setTimeout(() => {
          router.push("/auth");
        }, 2000);
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      toast.error("Invalid code", {
        description: error.message || "Please check your code and try again.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

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
            Verify Invitation Code
          </h1>
          <p className="text-lg text-muted-foreground">
            Enter the invitation code you received via email
          </p>
        </div>

        {/* Main Content */}
        <div className="relative z-10 px-6 pb-12 max-w-md mx-auto">
          {isVerified ? (
            <Card className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl shadow-2xl">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="bg-green-500/20 inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Access Granted!</h2>
                  <p className="text-muted-foreground mb-4">
                    Your invitation code has been verified. You now have access to SimplSEO.
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Redirecting to login...
                  </p>
                  <Button
                    onClick={() => router.push("/auth")}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    Go to Login
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl shadow-2xl">
              <CardHeader>
                <CardTitle>Enter Your Invitation Code</CardTitle>
                <CardDescription>
                  Check your email for the invitation code we sent you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Invitation Code</Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX"
                      maxLength={9}
                      className="bg-white/5 border-white/10 backdrop-blur-sm text-center text-2xl font-mono tracking-widest"
                      style={{ letterSpacing: "0.5em" }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: XXXX-XXXX (e.g., A3F9-K2M7)
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isVerifying || !code.trim()}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        Verify Code
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-sm text-muted-foreground text-center">
                    Don&apos;t have a code?{" "}
                    <button
                      onClick={() => router.push("/request-access")}
                      className="text-[#00BF63] hover:underline"
                    >
                      Request access
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

