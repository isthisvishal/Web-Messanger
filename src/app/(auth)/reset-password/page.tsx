"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";

function ResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);

  const onPasswordChange = (v: string) => {
    setPassword(v);
    let s = 0;
    if (v.length >= 8) s++; if (v.length >= 12) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
    setScore(s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Password reset! Please log in.");
      router.push("/login");
    } catch { toast.error("Something went wrong."); } finally { setLoading(false); }
  };

  const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>Choose a strong password (min 12 chars)</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input id="new-password" type={showPassword ? "text" : "password"} value={password}
                  onChange={e => onPasswordChange(e.target.value)} className="pr-10" required minLength={12} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {password && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${colors[score]}`} style={{ width: `${score * 25}%` }} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)} required minLength={12} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Reset Password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}><ResetContent /></Suspense>);
}
