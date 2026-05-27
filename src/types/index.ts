import type { Role, OtpPurpose, EmailTemplateType } from "@prisma/client";

export type { Role, OtpPurpose, EmailTemplateType };


export interface SessionData {
  userId: string;
  email: string;
  role: Role;
  displayName: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface SessionCookie {
  token: string;
  expiresAt: number;
}


export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


export interface RegisterRequest {
  email: string;
  displayName: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
  purpose: OtpPurpose;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}


export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
}

export interface KeyBlob {
  encryptedKeyBlob: string;
  keyBlobSalt: string;
}

export interface IdentityKeyPair {
  publicKey: string;
  encryptedPrivateKey: string;
}


export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  messageIndex: number;
}

export interface DecryptedMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Date;
  deliveredAt?: Date;
}


export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  messagesLast24h: number;
  messagesLast7d: number;
  messagesLast30d: number;
  smtpActive: boolean;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  isBanned: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface SmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export interface EmailTemplateInput {
  type: EmailTemplateType;
  subject: string;
  htmlBody: string;
  textBody: string;
}


export interface PasskeyInfo {
  id: string;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}


export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}
