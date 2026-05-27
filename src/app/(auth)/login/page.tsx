"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Loader2, Mail, Lock, Fingerprint } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [passkeyMode, setPasskeyMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      sessionStorage.setItem("temp_password", form.password);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.data?.purpose === "EMAIL_VERIFY") {
          toast.info("Please verify your email first.");
          router.push(`/verify-otp?email=${encodeURIComponent(form.email)}&purpose=EMAIL_VERIFY`);
          return;
        }
        toast.error(data.error || "Login failed");
        return;
      }

      toast.success("Verification code sent to your email");
      router.push(`/verify-otp?email=${encodeURIComponent(form.email)}&purpose=LOGIN`);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyAuth = async () => {
    if (!form.email) {
      toast.error("Please enter your email first");
      return;
    }
    setLoading(true);

    try {
      const optRes = await fetch("/api/auth/passkey/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const optData = await optRes.json();
      if (!optRes.ok) {
        toast.error(optData.error || "No passkeys found");
        return;
      }

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const authResponse = await startAuthentication(optData.data.options);

      const verRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResponse, userId: optData.data.userId }),
      });

      const verData = await verRes.json();
      if (!verRes.ok) {
        toast.error(verData.error || "Passkey authentication failed");
        return;
      }

      toast.success("Welcome back!");
      router.push(verData.data.redirect || "/chat");
    } catch (err) {
      toast.error("Passkey authentication cancelled or failed");
    } finally {
      setLoading(false);
    }
  };

  const supportsPasskeys = typeof window !== "undefined" && !!window.PublicKeyCredential;

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass-card animate-fade-in relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center glow-primary">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">
            <span className="gradient-text">Welcome Back</span>
          </CardTitle>
          <CardDescription>Sign in to your encrypted messenger</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {!passkeyMode && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="login-password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}


            {supportsPasskeys && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={handlePasskeyAuth}
                  disabled={loading}
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  Sign in with Passkey
                </Button>
              </>
            )}


            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full h-11" onClick={() => (window.location.href = "/api/auth/google")}>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </Button>
          </CardContent>

          <CardFooter className="flex-col space-y-4">
            {!passkeyMode && (
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Sign In
              </Button>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">Sign up</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
