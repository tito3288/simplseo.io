"use client";

import React, { useState } from "react";
import BouncingLoader from "../components/ui/bouncing-loader";
import SquashBounceLoader from "../components/ui/squash-bounce-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMinimumLoading } from "../hooks/use-minimum-loading";

export default function DemoPage() {
  const [isLoading, setIsLoading] = useState(false);
  const shouldShowLoader = useMinimumLoading(isLoading, 3000);

  const simulateLoading = () => {
    setIsLoading(true);
    // Simulate fast loading (500ms)
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Bouncing Loader Demo</h1>
        
        <div className="grid gap-6">
          {/* Single Bouncing Ball */}
          <Card>
            <CardHeader>
              <CardTitle>Single Bouncing Ball (Improved Squash & Stretch)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Small:</span>
                <SquashBounceLoader size="sm" />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Medium:</span>
                <SquashBounceLoader size="md" />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Large:</span>
                <SquashBounceLoader size="lg" />
              </div>
            </CardContent>
          </Card>

          {/* Different Sizes */}
          <Card>
            <CardHeader>
              <CardTitle>Multiple Bouncing Dots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Small:</span>
                <BouncingLoader size="sm" />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Medium:</span>
                <BouncingLoader size="md" />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Large:</span>
                <BouncingLoader size="lg" />
              </div>
            </CardContent>
          </Card>

          {/* Minimum Loading Time Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Minimum Loading Time Demo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <Button onClick={simulateLoading} className="mb-4">
                  Simulate Fast Loading (500ms)
                </Button>
                <p className="text-sm text-muted-foreground mb-4">
                  This will show the loader for at least 3 seconds, even though the data loads in 500ms
                </p>
                {shouldShowLoader && (
                  <div className="text-center py-8">
                    <SquashBounceLoader size="lg" className="mb-4" />
                    <p className="text-sm text-muted-foreground">Loading data...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loading States */}
          <Card>
            <CardHeader>
              <CardTitle>Loading States Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <SquashBounceLoader size="lg" className="mb-4" />
                <p className="text-sm text-muted-foreground">Single ball loading...</p>
              </div>
              
              <div className="text-center py-8">
                <BouncingLoader size="lg" className="mb-4" />
                <p className="text-sm text-muted-foreground">Multiple dots loading...</p>
              </div>
            </CardContent>
          </Card>

          {/* Code Example */}
          <Card>
            <CardHeader>
              <CardTitle>Code Examples</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
{`// Single bouncing ball with improved squash & stretch
import SquashBounceLoader from "../components/ui/squash-bounce-loader";

<SquashBounceLoader size="lg" />

// Multiple bouncing dots
import BouncingLoader from "../components/ui/bouncing-loader";

<BouncingLoader size="lg" />

// With minimum loading time (3 seconds)
import { useMinimumLoading } from "../hooks/use-minimum-loading";

const [loading, setLoading] = useState(true);
const shouldShowLoader = useMinimumLoading(loading, 3000);

if (shouldShowLoader) {
  return <SquashBounceLoader size="lg" />;
}

// In a loading state
<div className="text-center py-8">
  <SquashBounceLoader size="lg" className="mb-4" />
  <p className="text-sm text-muted-foreground">
    Loading data...
  </p>
</div>`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 