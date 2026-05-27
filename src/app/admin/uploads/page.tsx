"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HardDrive, Clock, Settings, Loader2, ArrowLeft } from "lucide-react";

export default function UploadSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxUploadSize, setMaxUploadSize] = useState("15");
  const [fileExpiryHours, setFileExpiryHours] = useState("24");
  const [stats, setStats] = useState({ totalFiles: 0, totalBytes: 0 });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const resData = await res.json();
      if (resData.success) {
        setMaxUploadSize(resData.data.maxUploadSize.toString());
        setFileExpiryHours(resData.data.fileExpiryHours.toString());
        if (resData.data.stats) {
          setStats(resData.data.stats);
        }
      } else {
        toast.error("Failed to load upload settings");
      }
    } catch {
      toast.error("Network error loading settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUploadSize: parseFloat(maxUploadSize),
          fileExpiryHours: parseFloat(fileExpiryHours),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Settings updated successfully!");
        fetchSettings();
      } else {
        toast.error(data.error || "Failed to update settings");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold gradient-text">Upload Settings</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/users" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">Users</Link>
            <Link href="/admin/smtp" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">SMTP</Link>
            <Link href="/admin/email-templates" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">Templates</Link>
            <Link href="/chat" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">← Back</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Settings Form */}
            <Card className="glass-card md:col-span-2">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Configuration Limits
                </CardTitle>
                <CardDescription>
                  Define size limits and file retention periods for all E2E chat uploads.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSave}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-upload-size">Maximum File Upload Limit (MB)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="max-upload-size"
                        type="number"
                        min="1"
                        step="0.1"
                        value={maxUploadSize}
                        onChange={(e) => setMaxUploadSize(e.target.value)}
                        required
                        className="bg-background/50"
                      />
                      <span className="text-sm font-semibold text-muted-foreground">MB</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Restricts the size of files that users can upload (e.g. 15 for 15MB).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file-expiry-hours">Auto-Deletion Retention (Hours)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="file-expiry-hours"
                        type="number"
                        min="1"
                        step="0.5"
                        value={fileExpiryHours}
                        onChange={(e) => setFileExpiryHours(e.target.value)}
                        required
                        className="bg-background/50"
                      />
                      <span className="text-sm font-semibold text-muted-foreground">Hours</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All uploaded files are permanently deleted from the disk after this time limit (e.g., 24 for 1 day).
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border/50 pt-4">
                  <Button type="submit" className="ml-auto" disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Storage Usage Stats */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-primary" />
                  Storage Usage
                </CardTitle>
                <CardDescription>
                  Current status of the secure upload folder.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Stored Files</p>
                  <p className="text-3xl font-bold">{stats.totalFiles}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Disk Space Used</p>
                  <p className="text-3xl font-bold">{formatBytes(stats.totalBytes)}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-4">
                  <Clock className="w-4 h-4 text-green-400" />
                  Auto-purging active based on configuration.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
