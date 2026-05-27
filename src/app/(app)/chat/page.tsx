"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Shield, Send, LogOut, Settings, Users, MessageSquare,
  Search, Plus, Moon, Sun, Loader2, Lock, Unlock, Eye, EyeOff, UserPlus
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  setupNewUserKeys,
  unlockUserKeys,
  initConversationKeys,
  decryptConversationKey,
  encryptChatMessage,
  decryptChatMessage,
  UserCryptoContext
} from "@/lib/crypto/chat-crypto";

interface Conversation {
  id: string;
  conversation: {
    id: string;
    members: Array<{
      user: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        publicIdentityKey: string | null;
      };
      encryptedSessionKey: string | null;
    }>;
    messages: Array<{
      id: string;
      ciphertext: string;
      nonce: string;
      senderId: string;
      createdAt: string;
    }>;
  };
}

interface DecryptedMsg {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [cryptoContext, setCryptoContext] = useState<UserCryptoContext | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isNewUserKeys, setIsNewUserKeys] = useState(false);
  const [keySetupLoading, setKeySetupLoading] = useState(false);
  const [keyPassword, setKeyPassword] = useState("");
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [userKeysPayload, setUserKeysPayload] = useState<any>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convKeys, setConvKeys] = useState<{ [convId: string]: CryptoKey }>({});
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMsg[]>([]);
  const [newMessage, setNewMessage] = useState("");
  
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUserKeys();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  const checkUserKeys = async () => {
    try {
      const res = await fetch("/api/user/keys");
      const resData = await res.json();

      if (!res.ok) {
        toast.error("Failed to load user cryptographic configuration");
        return;
      }

      const keysData = resData.data;

      const userProfileRes = await fetch("/api/admin/users").catch(() => null);
      if (userProfileRes && userProfileRes.ok) {
      }

      if (!keysData || !keysData.publicIdentityKey) {
        setIsNewUserKeys(true);
        const tempPassword = sessionStorage.getItem("temp_password");
        if (tempPassword) {
          handleAutoSetup(tempPassword);
        }
      } else {
        setUserKeysPayload(keysData);
        const tempPassword = sessionStorage.getItem("temp_password");
        if (tempPassword) {
          handleAutoUnlock(tempPassword, keysData);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error checking secure identity");
    } finally {
      setLoadingConvs(false);
    }
  };

  const handleAutoSetup = async (password: string) => {
    setKeySetupLoading(true);
    try {
      const result = await setupNewUserKeys(password);
      const uploadRes = await fetch("/api/user/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.uploadPayload),
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload encryption keys to server");
      }

      setCryptoContext(result.context);
      setIsUnlocked(true);
      sessionStorage.removeItem("temp_password");
      toast.success("Zero-Knowledge secure identity initialized!");
      fetchConversations(result.context);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to initialize keys");
    } finally {
      setKeySetupLoading(false);
    }
  };

  const handleAutoUnlock = async (password: string, keysData: any) => {
    setKeySetupLoading(true);
    try {
      const context = await unlockUserKeys(
        password,
        keysData.keyBlobSalt,
        keysData.encryptedKeyBlob,
        keysData.encryptedIdentityKey,
        keysData.publicIdentityKey
      );
      setCryptoContext(context);
      setIsUnlocked(true);
      sessionStorage.removeItem("temp_password");
      toast.success("Secure identity unlocked!");
      fetchConversations(context);
    } catch (err) {
      console.error(err);
    } finally {
      setKeySetupLoading(false);
    }
  };

  const handleManualUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyPassword.trim()) return;
    setKeySetupLoading(true);

    try {
      if (isNewUserKeys) {
        await handleAutoSetup(keyPassword);
      } else {
        const context = await unlockUserKeys(
          keyPassword,
          userKeysPayload.keyBlobSalt,
          userKeysPayload.encryptedKeyBlob,
          userKeysPayload.encryptedIdentityKey,
          userKeysPayload.publicIdentityKey
        );
        setCryptoContext(context);
        setIsUnlocked(true);
        setKeyPassword("");
        toast.success("Messages decrypted successfully!");
        fetchConversations(context);
      }
    } catch (err) {
      console.error(err);
      toast.error("Incorrect account password. Please try again.");
    } finally {
      setKeySetupLoading(false);
    }
  };

  const fetchConversations = async (context: UserCryptoContext) => {
    setLoadingConvs(true);
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      if (data.success) {
        const convList: Conversation[] = data.data || [];
        setConversations(convList);

        if (convList.length > 0) {
          const firstConv = convList[0];
          const ownMember = firstConv.conversation.members.find(
            m => m.user.publicIdentityKey === context.publicIdentityKey
          );
          if (ownMember) {
            setCurrentUserId(ownMember.user.id);
          }
        }

        const decryptedKeys: { [convId: string]: CryptoKey } = {};
        for (const item of convList) {
          if (item.conversation.members.length === 2 && item.conversation.members.some(m => m.encryptedSessionKey)) {
            const ownMember = item.conversation.members.find(
              m => m.user.publicIdentityKey === context.publicIdentityKey
            );
            const otherMember = item.conversation.members.find(
              m => m.user.publicIdentityKey !== context.publicIdentityKey
            );

            if (ownMember && ownMember.encryptedSessionKey) {
              try {
                const convKey = await decryptConversationKey(
                  ownMember.encryptedSessionKey,
                  context.masterKey,
                  context.privateKey,
                  otherMember?.user.publicIdentityKey || undefined
                );
                decryptedKeys[item.conversation.id] = convKey;
              } catch (err) {
                console.error(`Failed to decrypt conversation key for ${item.conversation.id}:`, err);
              }
            }
          }
        }
        setConvKeys(decryptedKeys);
      }
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoadingConvs(false);
    }
  };

  const decryptMessageList = async (rawMessages: any[], convId: string, context: UserCryptoContext) => {
    const convKey = convKeys[convId];
    if (!convKey) {
      setDecryptedMessages(rawMessages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender.displayName,
        content: "[🔒 Encryption Key Locked]",
        createdAt: m.createdAt
      })));
      return;
    }

    const decrypted = await Promise.all(
      rawMessages.map(async m => {
        try {
          const plain = await decryptChatMessage(m.ciphertext, m.nonce, convKey);
          return {
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender.displayName,
            content: plain,
            createdAt: m.createdAt
          };
        } catch (err) {
          return {
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender.displayName,
            content: "[🔒 Decryption Error]",
            createdAt: m.createdAt
          };
        }
      })
    );
    setDecryptedMessages(decrypted.reverse());
  };

  const fetchMessages = async (convId: string, context: UserCryptoContext) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      const data = await res.json();
      if (data.success) {
        await decryptMessageList(data.data || [], convId, context);
      }
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectConversation = (convId: string) => {
    setSelectedConv(convId);
    if (cryptoContext) {
      fetchMessages(convId, cryptoContext);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv || !cryptoContext) return;
    const convKey = convKeys[selectedConv];
    if (!convKey) {
      toast.error("Cannot send message: conversation key is locked");
      return;
    }

    setSending(true);
    try {
      const encrypted = await encryptChatMessage(newMessage, convKey);

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConv,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          messageIndex: decryptedMessages.length,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const savedMsg = data.data;
        const plainMsg: DecryptedMsg = {
          id: savedMsg.id,
          senderId: savedMsg.senderId,
          senderName: savedMsg.sender.displayName,
          content: newMessage,
          createdAt: savedMsg.createdAt
        };
        setDecryptedMessages(prev => [...prev, plainMsg]);
        setNewMessage("");
        
        fetchConversations(cryptoContext);
      } else {
        toast.error("Failed to send message");
      }
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleSearchContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearchingUser(true);
    setSearchResult(null);

    try {
      const res = await fetch(`/api/users/search?email=${encodeURIComponent(searchEmail)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSearchResult(data.data);
      } else {
        toast.error(data.error || "User not found");
      }
    } catch {
      toast.error("Failed to search user");
    } finally {
      setSearchingUser(false);
    }
  };

  const startNewConversation = async (contact: any) => {
    if (!cryptoContext) return;
    setSending(true);

    try {
      const existing = conversations.find(c =>
        c.conversation.members.some(m => m.user.id === contact.id)
      );

      if (existing) {
        setSelectedConv(existing.conversation.id);
        fetchMessages(existing.conversation.id, cryptoContext);
        setShowSearchModal(false);
        setSearchEmail("");
        setSearchResult(null);
        setSending(false);
        return;
      }

      if (!contact.publicIdentityKey) {
        toast.error("This user has not initialized E2E cryptographic keys yet. They must log in to set up E2E.");
        setSending(false);
        return;
      }

      const keyPack = await initConversationKeys(
        cryptoContext.privateKey,
        cryptoContext.masterKey,
        contact.publicIdentityKey
      );

      const initialText = "👋 Connection established. Secure E2E chat opened!";
      const encrypted = await encryptChatMessage(initialText, keyPack.conversationKey);

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: contact.id,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          messageIndex: 0,
          myEncryptedSessionKey: keyPack.myEncryptedSessionKey,
          theirEncryptedSessionKey: keyPack.theirEncryptedSessionKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("E2E Conversation opened!");
        setShowSearchModal(false);
        setSearchEmail("");
        setSearchResult(null);
        
        const newConvId = data.data.conversationId;
        setConvKeys(prev => ({ ...prev, [newConvId]: keyPack.conversationKey }));
        
        await fetchConversations(cryptoContext);
        setSelectedConv(newConvId);
        setDecryptedMessages([{
          id: data.data.id,
          senderId: currentUserId,
          senderName: "Me",
          content: initialText,
          createdAt: data.data.createdAt
        }]);
      } else {
        toast.error(data.error || "Failed to start conversation");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to initiate key agreement");
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.clear();
    router.push("/login");
  };

  const filteredConversations = conversations.filter(conv => {
    const otherMember = conv.conversation.members.find(m => m.user.publicIdentityKey !== cryptoContext?.publicIdentityKey);
    return otherMember?.user.displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedConversationData = conversations.find(c => c.conversation.id === selectedConv);
  const selectedOtherMember = selectedConversationData?.conversation.members.find(
    m => m.user.publicIdentityKey !== cryptoContext?.publicIdentityKey
  );

  if (!isUnlocked) {
    return (
      <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <Card className="w-full max-w-md glass-card animate-fade-in relative z-10">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center glow-primary">
              {isNewUserKeys ? <Unlock className="w-8 h-8 text-primary animate-pulse" /> : <Lock className="w-8 h-8 text-primary" />}
            </div>
            <CardTitle className="text-3xl font-bold">
              <span className="gradient-text">{isNewUserKeys ? "Initialize Identity" : "Unlock Secure Vault"}</span>
            </CardTitle>
            <CardDescription>
              {isNewUserKeys
                ? "This appears to be your first login. We need your account password to initialize your client-side cryptographic keys."
                : "Your E2E encryption keys are encrypted at rest. Please enter your account password to decrypt them locally."}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleManualUnlockSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-password">Account Password</Label>
                <div className="relative">
                  <Input
                    id="key-password"
                    type={showKeyPassword ? "text" : "password"}
                    placeholder="Enter account password"
                    value={keyPassword}
                    onChange={e => setKeyPassword(e.target.value)}
                    className="pr-10 h-11"
                    disabled={keySetupLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyPassword(!showKeyPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKeyPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full h-11" disabled={keySetupLoading || !keyPassword.trim()}>
                {keySetupLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isNewUserKeys ? "Generating secure keys..." : "Decrypting credentials..."}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    {isNewUserKeys ? "Setup Encrypted Profile" : "Unlock Chat Messages"}
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">

      <div className="w-80 border-r border-border flex flex-col bg-card/40 backdrop-blur-xl relative z-20">

        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h1 className="font-extrabold text-lg tracking-tight gradient-text">Messager</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/settings")}>
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 bg-muted/30 border-muted" />
          </div>
        </div>


        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingConvs ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg animate-pulse bg-accent/10">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-3">
              <MessageSquare className="w-12 h-12 opacity-30 animate-pulse text-primary" />
              <p className="font-semibold text-sm">No Conversations</p>
              <p className="text-xs">Initiate a secure E2E connection by searching contacts.</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const other = conv.conversation.members.find(m => m.user.publicIdentityKey !== cryptoContext?.publicIdentityKey);
              const lastMsg = conv.conversation.messages[0];
              const isSelected = selectedConv === conv.conversation.id;

              return (
                <button key={conv.conversation.id}
                  onClick={() => selectConversation(conv.conversation.id)}
                  className={`w-full p-3.5 flex items-center gap-3 border-b border-border/20 transition-all hover:bg-accent/40 text-left ${isSelected ? "bg-accent/60 shadow-sm border-l-4 border-l-primary pl-2.5" : ""}`}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                    {(other?.user.displayName || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="font-semibold text-sm truncate">{other?.user.displayName || "Unknown"}</p>
                      {lastMsg && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Lock className="w-3 h-3 text-primary flex-shrink-0" />
                      <span>E2E Encrypted</span>
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>


        <div className="p-4 border-t border-border bg-card/60">
          <Button className="w-full h-10 font-medium" onClick={() => setShowSearchModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />New Secure Chat
          </Button>
        </div>
      </div>


      <div className="flex-1 flex flex-col bg-accent/5 relative z-10">
        {selectedConv ? (
          <>

            <div className="p-4 border-b border-border flex items-center justify-between bg-card/30 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                  {(selectedOtherMember?.user.displayName || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedOtherMember?.user.displayName || "Conversation"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500/80 font-medium">Secured with P-256 ECDH & AES-256-GCM</span>
                  </p>
                </div>
              </div>
            </div>


            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground font-medium">Decrypting connection logs...</p>
                </div>
              ) : decryptedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                  <Lock className="w-10 h-10 mb-2 text-primary opacity-50 animate-bounce" />
                  <p className="font-semibold text-sm">Secure Line Established</p>
                  <p className="text-xs mt-1">Start messaging. The server has no visibility over this plaintext conversation.</p>
                </div>
              ) : (
                decryptedMessages.map(msg => {
                  const isOwn = msg.senderId === currentUserId;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-slide-in`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm border ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-none border-primary/10"
                          : "bg-card border-border/40 rounded-bl-none text-foreground"
                      }`}>
                        <p className="text-sm break-words leading-relaxed">{msg.content}</p>
                        <p className="text-[9px] opacity-60 mt-1.5 text-right font-medium">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>


            <div className="p-4 border-t border-border bg-card/30 backdrop-blur-md">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                <Input
                  placeholder="Type an encrypted message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  className="flex-1 h-11 bg-background/50 border-muted-foreground/20"
                  disabled={sending}
                  required
                />
                <Button type="submit" disabled={sending || !newMessage.trim()} size="icon" className="h-11 w-11">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#25d366_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
            <div className="max-w-md space-y-4 relative z-10">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 glow-primary">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Zero-Knowledge Secure Terminal</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Choose an existing chat, or start a new E2E encrypted session. All messages are encrypted locally using P-256 ECDH exchange.
              </p>
            </div>
          </div>
        )}
      </div>


      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md glass-card">
            <CardHeader>
              <CardTitle>Initiate Secure Chat</CardTitle>
              <CardDescription>Search for an user by email address to perform ECDH key exchange.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSearchContact}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search-email">Email Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="search-email"
                      type="email"
                      placeholder="user@example.com"
                      value={searchEmail}
                      onChange={e => setSearchEmail(e.target.value)}
                      required
                    />
                    <Button type="submit" disabled={searchingUser}>
                      {searchingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {searchResult && (
                  <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex items-center justify-between animate-slide-in">
                    <div>
                      <p className="font-semibold text-sm">{searchResult.displayName}</p>
                      <p className="text-xs text-muted-foreground">{searchResult.email}</p>
                      {!searchResult.publicIdentityKey && (
                        <p className="text-[10px] text-destructive font-semibold mt-1">⚠️ Missing encryption keys</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => startNewConversation(searchResult)}
                      disabled={sending || !searchResult.publicIdentityKey}
                    >
                      {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                      Start
                    </Button>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t border-border/40 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowSearchModal(false);
                    setSearchEmail("");
                    setSearchResult(null);
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
