"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AdminSmtpPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    host: "", port: 587, secure: true,
    username: "", password: "",
    fromName: "", fromEmail: "",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/smtp").then(r => r.json()).then(data => {
      if (data.data) {
        setForm({
          host: data.data.host || "", port: data.data.port || 587,
          secure: data.data.secure ?? true, username: data.data.username || "",
          password: "", fromName: data.data.fromName || "", fromEmail: data.data.fromEmail || "",
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (test: boolean) => {
    setSaving(true); setTestResult(null);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, testEmail: test }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        if (test) setTestResult({ success: true, message: "Test email sent!" });
      } else {
        toast.error(data.error);
        if (test) setTestResult({ success: false, message: data.error });
      }
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="w-6 h-6 text-primary" />SMTP Configuration</h1>
          <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Email Server Settings</CardTitle>
            <CardDescription>Configure SMTP for sending emails. Password is AES-256-GCM encrypted before storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input placeholder="smtp.gmail.com" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <select className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))}>
                  <option value={25}>25 (SMTP)</option>
                  <option value={465}>465 (SSL)</option>
                  <option value={587}>587 (STARTTLS)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="smtp-secure" checked={form.secure} onChange={e => setForm(f => ({ ...f, secure: e.target.checked }))} className="rounded" />
              <Label htmlFor="smtp-secure">Use TLS/SSL</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Username</Label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Enter SMTP password" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>From Name</Label><Input value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} placeholder="Web Messenger" /></div>
              <div className="space-y-2"><Label>From Email</Label><Input type="email" value={form.fromEmail} onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))} /></div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${testResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {testResult.message}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={() => handleSave(false)} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save Configuration
              </Button>
              <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>Test & Save</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
