"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Always redirect to home page
    router.replace("/home");
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="flex space-x-2 justify-center mb-4">
          <div className="w-3 h-3 rounded-full bg-[#00bf63] animate-pulse"></div>
          <div className="w-3 h-3 rounded-full bg-[#00bf63] animate-pulse delay-75"></div>
          <div className="w-3 h-3 rounded-full bg-[#00bf63] animate-pulse delay-150"></div>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
