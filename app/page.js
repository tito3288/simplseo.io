"use client";

import { useAuth } from "./contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAccessRequestEnabled } from "./lib/accessRequestConfig";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isCheckingApproval, setIsCheckingApproval] = useState(true);

  useEffect(() => {
    const checkApprovalAndRedirect = async () => {
      if (isLoading) return;

      // If access request is disabled, use normal flow
      if (!isAccessRequestEnabled()) {
        if (user) {
          router.push("/dashboard");
        } else {
          router.push("/auth");
        }
        setIsCheckingApproval(false);
        return;
      }

      // Access request enabled - check approval
      // If user is logged in, check their email approval
      if (user) {
        try {
          const response = await fetch(`/api/check-approval?email=${encodeURIComponent(user.email)}`);
          const data = await response.json();
          
          if (data.approved) {
            // User is approved and logged in - go to dashboard
            router.push("/dashboard");
          } else {
            // User is logged in but not approved - go to request page
            router.push("/request-access");
          }
        } catch (error) {
          console.error("Error checking approval:", error);
          router.push("/request-access");
        }
        setIsCheckingApproval(false);
        return;
      }

      // User is not logged in - check localStorage for previously verified email
      const storedEmail = localStorage.getItem("approvedEmail");
      if (storedEmail) {
        try {
          const response = await fetch(`/api/check-approval?email=${encodeURIComponent(storedEmail)}`);
          const data = await response.json();
          
          if (data.approved) {
            // Email is approved - go to auth page
            router.push("/auth");
          } else {
            // Email approval was revoked or invalid - clear it and go to auth
            localStorage.removeItem("approvedEmail");
            router.push("/auth");
          }
        } catch (error) {
          console.error("Error checking approval:", error);
          router.push("/auth");
        }
        setIsCheckingApproval(false);
        return;
      }

      // No stored email - first-time visitor - go to auth page
      // They can try to log in or create account
      // If they try to create account with non-approved email, they'll be redirected to request-access
      router.push("/auth");
      setIsCheckingApproval(false);
    };

    checkApprovalAndRedirect();
  }, [isLoading, user, router]);

  // Show loading state while checking
  if (isCheckingApproval || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00BF63] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
