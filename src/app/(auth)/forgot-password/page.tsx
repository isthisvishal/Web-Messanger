"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Mail, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      toast.success(data.message || "If that email exists, a reset code was sent.");
      router.push(`/verify-otp?email=${encodeURIComponent(email)}&purpose=FORGOT_PASSWORD`);
    } catch { toast.error("Something went wrong."); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-orange-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send a reset code</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input id="forgot-email" type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Reset Code
            </Button>
            <Link href="/login" className="text-sm text-primary hover:underline">Back to login</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
