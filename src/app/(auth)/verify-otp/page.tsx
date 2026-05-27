"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Loader2, RefreshCw } from "lucide-react";

function OtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const purpose = searchParams.get("purpose") || "LOGIN";
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const submitOtp = async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, purpose }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setOtp(["","","","","",""]); inputRefs.current[0]?.focus(); return; }
      toast.success(data.message || "Verified!");
      if (data.data?.redirect) router.push(data.data.redirect);
    } catch { toast.error("Something went wrong."); } finally { setLoading(false); }
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...otp]; n[i] = v.slice(-1); setOtp(n);
    if (v && i < 5) inputRefs.current[i + 1]?.focus();
    if (n.every(d => d) && n.join("").length === 6) submitOtp(n.join(""));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const n = [...otp]; for (let i = 0; i < 6; i++) n[i] = t[i] || "";
    setOtp(n); if (t.length === 6) submitOtp(t);
  };

  const labels: Record<string, string> = { LOGIN: "Login Verification", EMAIL_VERIFY: "Email Verification", FORGOT_PASSWORD: "Password Reset" };

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center glow-primary">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">{labels[purpose] || "Verify"}</CardTitle>
          <CardDescription>Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {otp.map((d, i) => (
              <input key={i} ref={el => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => { if (e.key === "Backspace" && !otp[i] && i > 0) inputRefs.current[i-1]?.focus(); }}
                className="otp-input" disabled={loading} aria-label={`Digit ${i+1}`} />
            ))}
          </div>
          {loading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          <div className="text-center">
            <Button variant="ghost" size="sm" disabled={resendCooldown > 0} onClick={() => setResendCooldown(60)}>
              <RefreshCw className="w-4 h-4 mr-1" />{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}><OtpContent /></Suspense>);
}
