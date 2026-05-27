"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FileText, Loader2, Save, RotateCcw } from "lucide-react";

interface Template {
  type: string; subject: string; htmlBody: string; textBody: string;
  isActive: boolean; isCustom: boolean;
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/email-templates").then(r => r.json()).then(data => {
      if (data.success) { setTemplates(data.data); if (data.data.length > 0) setSelected(data.data[0]); }
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      if (res.ok) toast.success("Template saved");
      else { const d = await res.json(); toast.error(d.error); }
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const typeLabels: Record<string, string> = {
    LOGIN_OTP: "Login OTP", FORGOT_PASSWORD_OTP: "Password Reset", EMAIL_VERIFICATION: "Email Verification",
    WELCOME: "Welcome", ACCOUNT_BANNED: "Account Banned", PASSWORD_CHANGED: "Password Changed",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" />Email Templates</h1>
          <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">

        <div className="w-64 space-y-2">
          {templates.map(t => (
            <button key={t.type} onClick={() => setSelected(t)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${selected?.type === t.type ? "bg-primary/20 text-primary" : "hover:bg-accent"}`}>
              <p className="font-medium">{typeLabels[t.type] || t.type}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.isCustom ? "Customized" : "Default"}</p>
            </button>
          ))}
        </div>


        {selected && (
          <div className="flex-1 space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{typeLabels[selected.type] || selected.type}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input value={selected.subject} onChange={e => setSelected({ ...selected, subject: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">HTML Body</label>
                  <textarea className="w-full min-h-[300px] p-3 rounded-lg border border-input bg-background text-sm font-mono"
                    value={selected.htmlBody} onChange={e => setSelected({ ...selected, htmlBody: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plain Text Fallback</label>
                  <textarea className="w-full min-h-[120px] p-3 rounded-lg border border-input bg-background text-sm font-mono"
                    value={selected.textBody} onChange={e => setSelected({ ...selected, textBody: e.target.value })} />
                </div>


                <div className="space-y-2">
                  <label className="text-sm font-medium">Preview</label>
                  <div className="border border-border rounded-lg p-4 bg-background">
                    <iframe srcDoc={selected.htmlBody} className="w-full h-[400px] rounded" sandbox="" title="Email preview" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save Template
                  </Button>
                  <Button variant="outline"><RotateCcw className="w-4 h-4 mr-2" />Reset to Default</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
