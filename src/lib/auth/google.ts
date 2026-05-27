import { generateOAuthState, generatePKCEVerifier, generatePKCEChallenge } from "@/lib/crypto/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export interface GoogleUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth environment variables are not configured");
  }
  return { clientId, clientSecret, redirectUri };
}

export function generateGoogleAuthUrl(): {
  url: string;
  state: string;
  codeVerifier: string;
} {
  const config = getGoogleConfig();
  const state = generateOAuthState();
  const codeVerifier = generatePKCEVerifier();
  const codeChallenge = generatePKCEChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}`, state, codeVerifier };
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const config = getGoogleConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token: string;
  }>;
}

export async function getGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error("Failed to fetch Google user info");
  return response.json() as Promise<GoogleUser>;
}
