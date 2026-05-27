import {
  deriveKeyFromPassword,
  generateMasterKey,
  generateIdentityKeypair,
  exportPublicKey,
  importPublicKey,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptMasterKey,
  decryptMasterKey,
  encryptMessage,
  decryptMessage,
  deriveConversationKey,
  generateSalt,
  saltToBase64,
  base64ToSalt,
  exportAESKey,
  importAESKey,
  wrapAESKey,
  unwrapAESKey,
} from "./client";

export interface UserCryptoContext {
  masterKey: CryptoKey;
  privateKey: CryptoKey;
  publicIdentityKey: string;
}

export async function setupNewUserKeys(password: string): Promise<{
  context: UserCryptoContext;
  uploadPayload: {
    publicIdentityKey: string;
    encryptedIdentityKey: string;
    encryptedKeyBlob: string;
    keyBlobSalt: string;
  };
}> {
  const masterKey = await generateMasterKey();

  const identityKeyPair = await generateIdentityKeypair();

  const salt = generateSalt(32);
  const passwordKey = await deriveKeyFromPassword(password, salt);

  const encryptedPrivate = await encryptPrivateKey(identityKeyPair.privateKey, masterKey);

  const encryptedMaster = await encryptMasterKey(masterKey, passwordKey);

  const publicIdentityKeyBase64 = await exportPublicKey(identityKeyPair.publicKey);

  return {
    context: {
      masterKey,
      privateKey: identityKeyPair.privateKey,
      publicIdentityKey: publicIdentityKeyBase64,
    },
    uploadPayload: {
      publicIdentityKey: publicIdentityKeyBase64,
      encryptedIdentityKey: `${encryptedPrivate.ciphertext}:${encryptedPrivate.nonce}`,
      encryptedKeyBlob: `${encryptedMaster.ciphertext}:${encryptedMaster.nonce}`,
      keyBlobSalt: saltToBase64(salt),
    },
  };
}

export async function unlockUserKeys(
  password: string,
  keyBlobSaltBase64: string,
  encryptedKeyBlob: string,
  encryptedIdentityKey: string,
  publicIdentityKey: string
): Promise<UserCryptoContext> {
  const salt = base64ToSalt(keyBlobSaltBase64);
  const passwordKey = await deriveKeyFromPassword(password, salt);

  
  const [masterCiphertext, masterNonce] = encryptedKeyBlob.split(":");
  const masterKey = await decryptMasterKey(masterCiphertext, masterNonce, passwordKey);

  const [privCiphertext, privNonce] = encryptedIdentityKey.split(":");
  const privateKey = await decryptPrivateKey(privCiphertext, privNonce, masterKey);

  return {
    masterKey,
    privateKey,
    publicIdentityKey,
  };
}

export async function initConversationKeys(
  myPrivateKey: CryptoKey,
  myMasterKey: CryptoKey,
  theirPublicKeyBase64: string
): Promise<{
  conversationKey: CryptoKey;
  myEncryptedSessionKey: string;
  theirEncryptedSessionKey: string;
}> {
  const conversationKey = await generateMasterKey();

  const myWrapped = await wrapAESKey(conversationKey, myMasterKey);
  const myEncryptedSessionKey = `${myWrapped.ciphertext}:${myWrapped.nonce}`;

  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
  const sharedECDHKey = await deriveConversationKey(myPrivateKey, theirPublicKey);

  const theirWrapped = await wrapAESKey(conversationKey, sharedECDHKey);
  const theirEncryptedSessionKey = `${theirWrapped.ciphertext}:${theirWrapped.nonce}`;

  return {
    conversationKey,
    myEncryptedSessionKey,
    theirEncryptedSessionKey,
  };
}

export async function decryptConversationKey(
  encryptedSessionKey: string,
  myMasterKey: CryptoKey,
  myPrivateKey: CryptoKey,
  theirPublicKeyBase64?: string
): Promise<CryptoKey> {
  const [ciphertext, nonce] = encryptedSessionKey.split(":");
  if (!ciphertext || !nonce) {
    throw new Error("Invalid encrypted session key format");
  }

  try {
    const key = await unwrapAESKey(ciphertext, nonce, myMasterKey);
    return key;
  } catch (err) {
    if (!theirPublicKeyBase64) {
      throw new Error("Cannot decrypt session key: missing sender's public key");
    }
    const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
    const sharedECDHKey = await deriveConversationKey(myPrivateKey, theirPublicKey);
    const key = await unwrapAESKey(ciphertext, nonce, sharedECDHKey);
    return key;
  }
}

export async function encryptChatMessage(
  messageText: string,
  conversationKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  return encryptMessage(messageText, conversationKey);
}

export async function decryptChatMessage(
  ciphertext: string,
  nonce: string,
  conversationKey: CryptoKey
): Promise<string> {
  return decryptMessage(ciphertext, nonce, conversationKey);
}

export async function serializeKey(key: CryptoKey): Promise<string> {
  return exportAESKey(key);
}

export async function deserializeKey(base64: string): Promise<CryptoKey> {
  return importAESKey(base64);
}
