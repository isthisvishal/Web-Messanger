"use client";


function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}


export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 600000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"]
  );
}


export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
    "wrapKey",
    "unwrapKey",
  ]);
}


export async function generateIdentityKeypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
    "deriveBits",
  ]);
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey("spki", keyData, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

export async function encryptPrivateKey(
  privateKey: CryptoKey,
  masterKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = generateRandomBytes(12);
  const wrappedKey = await crypto.subtle.wrapKey("pkcs8", privateKey, masterKey, {
    name: "AES-GCM",
    iv: nonce,
  });
  return {
    ciphertext: arrayBufferToBase64(wrappedKey),
    nonce: arrayBufferToBase64(nonce.buffer),
  };
}

export async function decryptPrivateKey(
  ciphertext: string,
  nonce: string,
  masterKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedKey = base64ToArrayBuffer(ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(nonce));

  return crypto.subtle.unwrapKey(
    "pkcs8",
    wrappedKey,
    masterKey,
    { name: "AES-GCM", iv },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}


export async function encryptMasterKey(
  masterKey: CryptoKey,
  passwordKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = generateRandomBytes(12);
  const wrappedKey = await crypto.subtle.wrapKey("raw", masterKey, passwordKey, {
    name: "AES-GCM",
    iv: nonce,
  });
  return {
    ciphertext: arrayBufferToBase64(wrappedKey),
    nonce: arrayBufferToBase64(nonce.buffer),
  };
}

export async function decryptMasterKey(
  ciphertext: string,
  nonce: string,
  passwordKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedKey = base64ToArrayBuffer(ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(nonce));

  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    passwordKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}


export async function encryptMessage(
  plaintext: string,
  conversationKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const encoder = new TextEncoder();
  const nonce = generateRandomBytes(12);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    conversationKey,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    nonce: arrayBufferToBase64(nonce.buffer),
  };
}


export async function decryptMessage(
  ciphertext: string,
  nonce: string,
  conversationKey: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(nonce));

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    conversationKey,
    ciphertextBuffer
  );

  return decoder.decode(plaintextBuffer);
}


export async function deriveConversationKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, { name: "HKDF" }, false, [
    "deriveKey",
  ]);

  const encoder = new TextEncoder();
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: encoder.encode("web-messenger-conversation-key-v1"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}


export function generateSalt(length: number = 32): Uint8Array {
  return generateRandomBytes(length);
}

export function saltToBase64(salt: Uint8Array): string {
  return arrayBufferToBase64(salt.buffer);
}

export function base64ToSalt(base64: string): Uint8Array {
  return new Uint8Array(base64ToArrayBuffer(base64));
}


export async function exportAESKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

export async function importAESKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

export async function wrapAESKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const iv = generateRandomBytes(12);
  const wrapped = await crypto.subtle.wrapKey(
    "raw",
    keyToWrap,
    wrappingKey,
    { name: "AES-GCM", iv }
  );
  return {
    ciphertext: arrayBufferToBase64(wrapped),
    nonce: arrayBufferToBase64(iv.buffer),
  };
}

export async function unwrapAESKey(
  wrappedKeyBase64: string,
  ivBase64: string,
  unwrappingKey: CryptoKey
): Promise<CryptoKey> {
  const wrapped = base64ToArrayBuffer(wrappedKeyBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  return crypto.subtle.unwrapKey(
    "raw",
    wrapped,
    unwrappingKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

