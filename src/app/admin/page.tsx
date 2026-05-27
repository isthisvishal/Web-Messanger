"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, ShieldAlert, Mail, Activity, Settings } from "lucide-react";
import { toast } from "sonner";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  messagesLast24h: number;
  messagesLast7d: number;
  messagesLast30d: number;
  smtpActive: boolean;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(res => res.json())
      .then(resData => {
        if (resData.success) {
          setStats(resData.data);
        } else {
          toast.error("Failed to load dashboard stats");
        }
      })
      .catch(() => {
        toast.error("Network error loading dashboard stats");
      });
  }, []);

  const cards = [
    { title: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-400", href: "/admin/users" },
    { title: "Active (30d)", value: stats?.activeUsers ?? "—", icon: Activity, color: "text-green-400", href: "/admin/users" },
    { title: "Banned", value: stats?.bannedUsers ?? "—", icon: ShieldAlert, color: "text-red-400", href: "/admin/users" },
    { title: "Messages (24h)", value: stats?.messagesLast24h ?? "—", icon: MessageSquare, color: "text-purple-400", href: "#" },
    { title: "SMTP Status", value: stats?.smtpActive ? "Active" : "Not configured", icon: Mail, color: "text-orange-400", href: "/admin/smtp" },
    { title: "Upload Settings", value: "Limits & Expiry", icon: Settings, color: "text-teal-400", href: "/admin/uploads" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-text">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/admin/users" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">Users</Link>
            <Link href="/admin/smtp" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">SMTP</Link>
            <Link href="/admin/email-templates" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">Templates</Link>
            <Link href="/admin/uploads" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">Uploads</Link>
            <Link href="/chat" className="px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">← Back</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {cards.map(card => (
            <Link key={card.title} href={card.href}>
              <Card className="glass-card hover:border-primary/30 transition-all cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats ? card.value : <span className="skeleton inline-block w-16 h-8" />}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
