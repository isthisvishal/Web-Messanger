"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings, LogOut, Fingerprint, Shield, Loader2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleLogoutAll = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out of all devices");
      router.push("/login");
    } catch { toast.error("Failed"); } finally { setLoading(false); }
  };

  const registerPasskey = async () => {
    setLoading(true);
    try {
      const optRes = await fetch("/api/auth/passkey/register", { method: "POST" });
      const optData = await optRes.json();
      if (!optRes.ok) { toast.error(optData.error); return; }

      const { startRegistration } = await import("@simplewebauthn/browser");
      const regResponse = await startRegistration(optData.data);

      const verRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: regResponse, deviceName: "My Device" }),
      });
      const verData = await verRes.json();
      if (verRes.ok) toast.success("Passkey registered!");
      else toast.error(verData.error);
    } catch { toast.error("Passkey registration cancelled"); }
    finally { setLoading(false); }
  };

  const supportsPasskeys = typeof window !== "undefined" && !!window.PublicKeyCredential;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <Button variant="outline" onClick={() => router.push("/chat")}>Back to Chat</Button>
        </div>

        <Card className="glass-card">
          <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Customize your experience</CardDescription></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span>Theme</span>
              <Button variant="outline" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <><Sun className="w-4 h-4 mr-2" />Light</> : <><Moon className="w-4 h-4 mr-2" />Dark</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle>Security</CardTitle><CardDescription>Manage authentication methods</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {supportsPasskeys && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-primary" />
                  <div><p className="font-medium">Passkeys</p><p className="text-sm text-muted-foreground">Use biometrics or security key</p></div>
                </div>
                <Button onClick={registerPasskey} disabled={loading} size="sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Passkey"}
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-orange-400" />
                <div><p className="font-medium">Active Sessions</p><p className="text-sm text-muted-foreground">Log out from all devices</p></div>
              </div>
              <Button variant="destructive" size="sm" onClick={handleLogoutAll} disabled={loading}>
                <LogOut className="w-4 h-4 mr-2" />Log Out All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
