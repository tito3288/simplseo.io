"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { auth, db } from "../lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, signup, signInWithGoogle, isLoading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Missing Fields", {
        description: "Please fill in both email and password.",
      });
      return;
    }

    try {
      if (isLogin) {
        await login(email, password);
        const uid = auth.currentUser?.uid;
        const docRef = doc(db, "onboarding", uid);
        const docSnap = await getDoc(docRef);

        const hasCompletedOnboarding =
          docSnap.exists() && docSnap.data()?.isComplete;

        if (hasCompletedOnboarding) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } else {
        await signup(email, password);
        router.push("/onboarding"); // brand new user, go to onboarding
      }
    } catch (error) {
      toast({
        title: "Authentication error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      console.log("🔐 Starting Google login...");
      await signInWithGoogle();
      console.log("✅ Google login successful");

      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No authenticated user found");

      const docRef = doc(db, "onboarding", uid);
      const docSnap = await getDoc(docRef);

      const hasCompletedOnboarding =
        docSnap.exists() && docSnap.data()?.isComplete;

      // 🛡️ SAFEGUARD: Detect if user is trying to create new account with existing email
      if (!isLogin && hasCompletedOnboarding) {
        // User clicked "Create Account" but account already exists and is active
        toast.error("Account Already Exists", {
          description: "You already have an active account with this Google email. Please log in to your existing account, or use a different Google account to manage a separate GSC property.",
          duration: 10000,
        });
        
        // Sign them out so they can choose what to do
        await signOut(auth);
        setIsLogin(true); // Switch to login mode
        return; // Stop here, don't redirect
      }

      // Normal flow: redirect based on onboarding status
      if (hasCompletedOnboarding) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    } catch (error) {
      console.error("❌ Google login error:", error);
      toast({
        title: "Google Login Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div>
            <img
              src="./1.png"
              alt="SimplSEO.io Logo"
              className="w-full h-auto rounded-md"
            />
          </div>
          <p className="text-muted-foreground mt-2">
            Your personal SEO assistant for small businesses
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{isLogin ? "Log In" : "Create Account"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Welcome back! Sign in with your Google account to access your dashboard."
                : "Get started! Create an account with your Google account to begin optimizing your SEO."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full mb-6 flex items-center justify-center gap-2"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="h-5 w-5"
              />
              Continue with Google
            </Button>

            {/* Email/Password form - Hidden but logic preserved for future use */}
            <form onSubmit={handleSubmit} className="space-y-4 hidden">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Log In" : "Create Account"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle between login/signup */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin
                  ? "Don't have an account?"
                  : "Already have an account?"}
                <button
                  type="button"
                  className="ml-1 text-primary hover:underline font-medium"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Create one" : "Log in"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
