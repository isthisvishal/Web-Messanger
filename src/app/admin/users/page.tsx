"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, ShieldAlert, ShieldCheck, Crown, Ban, UserCheck, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface UserItem {
  id: string; email: string; displayName: string; avatarUrl: string | null;
  role: string; isBanned: boolean; emailVerified: boolean;
  createdAt: string; lastLoginAt: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [banModal, setBanModal] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", displayName: "", password: "", role: "USER" });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), filter });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data); setTotal(data.total); setTotalPages(data.totalPages);
      }
    } catch { toast.error("Failed to load users"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [page, filter]);

  const handleBan = async (id: string) => {
    if (banReason.length < 10) { toast.error("Reason must be at least 10 characters"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/ban`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason }),
      });
      const data = await res.json();
      if (res.ok) { toast.success("User banned"); setBanModal(null); setBanReason(""); fetchUsers(); }
      else toast.error(data.error);
    } catch { toast.error("Failed"); } finally { setActionLoading(false); }
  };

  const handleUnban = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/unban`, { method: "POST" });
      if (res.ok) { toast.success("User unbanned"); fetchUsers(); }
    } catch { toast.error("Failed"); } finally { setActionLoading(false); }
  };

  const handleVerify = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/verify`, { method: "POST" });
      const data = await res.json();
      if (res.ok) { toast.success("User verified successfully"); fetchUsers(); }
      else { toast.error(data.error || "Failed to verify user"); }
    } catch { toast.error("Failed"); } finally { setActionLoading(false); }
  };

  const handleRole = async (id: string, action: "promote" | "demote") => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/make-admin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); fetchUsers(); }
      else toast.error(data.error);
    } catch { toast.error("Failed"); } finally { setActionLoading(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("User created successfully!");
        setCreateModal(false);
        setCreateForm({ email: "", displayName: "", password: "", role: "USER" });
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to create user");
      }
    } catch {
      toast.error("Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const roleIcon = (role: string) => {
    if (role === "SUPER_ADMIN") return <Crown className="w-4 h-4 text-yellow-400" />;
    if (role === "ADMIN") return <ShieldCheck className="w-4 h-4 text-blue-400" />;
    return null;
  };

  const filters = ["all", "admins", "banned", "active"];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">User Management</h1>
          <div className="flex items-center gap-4">
            <Button type="button" size="sm" onClick={() => { console.log("Create User Button Clicked"); setCreateModal(true); }}>Create User</Button>
            <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by email or name..." value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchUsers(); }}}
              className="pl-9" />
          </div>
          <div className="flex gap-2">
            {filters.map(f => (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm"
                onClick={() => { setFilter(f); setPage(1); }}
                className="capitalize">{f}</Button>
            ))}
          </div>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="p-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full skeleton" /><div className="space-y-1"><div className="h-4 w-32 skeleton" /><div className="h-3 w-40 skeleton" /></div></div></td>
                        <td className="p-4"><div className="h-4 w-16 skeleton" /></td>
                        <td className="p-4"><div className="h-4 w-16 skeleton" /></td>
                        <td className="p-4"><div className="h-4 w-24 skeleton" /></td>
                        <td className="p-4"><div className="h-4 w-20 skeleton ml-auto" /></td>
                      </tr>
                    ))
                  ) : users.map(user => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {user.displayName[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.displayName}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          {roleIcon(user.role)} {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          {user.isBanned ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Banned</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Active</span>
                          )}
                          {user.emailVerified ? (
                            <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                              <UserCheck className="w-3 h-3 text-green-500" /> Verified
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-destructive flex items-center gap-0.5">
                              <ShieldAlert className="w-3 h-3" /> Unverified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          {user.role !== "SUPER_ADMIN" && (
                            <>
                              {user.isBanned ? (
                                <Button size="sm" variant="outline" onClick={() => handleUnban(user.id)} disabled={actionLoading}>
                                  <UserCheck className="w-3 h-3 mr-1" />Unban
                                </Button>
                              ) : (
                                <Button size="sm" variant="destructive" onClick={() => setBanModal(user.id)} disabled={actionLoading}>
                                  <Ban className="w-3 h-3 mr-1" />Ban
                                </Button>
                              )}
                              {!user.emailVerified && (
                                <Button size="sm" variant="outline" onClick={() => handleVerify(user.id)} disabled={actionLoading} className="text-green-500 hover:text-green-600">
                                  <UserCheck className="w-3 h-3 mr-1" />Verify
                                </Button>
                              )}
                              {user.role === "USER" && (
                                <Button size="sm" variant="outline" onClick={() => handleRole(user.id, "promote")} disabled={actionLoading}>
                                  <ShieldCheck className="w-3 h-3 mr-1" />Make Admin
                                </Button>
                              )}
                              {user.role === "ADMIN" && (
                                <Button size="sm" variant="outline" onClick={() => handleRole(user.id, "demote")} disabled={actionLoading}>Remove Admin</Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>


        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} users total</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="flex items-center text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>


        {banModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md glass-card">
              <CardHeader><CardTitle className="text-destructive flex items-center gap-2"><ShieldAlert />Ban User</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Reason (min 10 chars)</label>
                  <textarea className="w-full mt-1 p-3 rounded-lg border border-input bg-background text-sm min-h-[100px]"
                    value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Enter ban reason..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setBanModal(null); setBanReason(""); }}>Cancel</Button>
                  <Button variant="destructive" onClick={() => handleBan(banModal)} disabled={actionLoading || banReason.length < 10}>
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Ban"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {createModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md glass-card">
              <CardHeader><CardTitle>Create New User</CardTitle></CardHeader>
              <form onSubmit={handleCreateUser}>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Display Name</label>
                    <Input required value={createForm.displayName} onChange={e => setCreateForm(f => ({ ...f, displayName: e.target.value }))} placeholder="John Doe" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Email Address</label>
                    <Input required type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Password (min 8 chars)</label>
                    <Input required type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Role</label>
                    <select className="w-full mt-1 p-2 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="outline" onClick={() => { setCreateModal(false); setCreateForm({ email: "", displayName: "", password: "", role: "USER" }); }}>Cancel</Button>
                    <Button type="submit" disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create User"}
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
