// All cryptographic operations using browser-native Web Crypto API

const PBKDF2_ITERATIONS = 200_000;
const AES_KEY_LENGTH = 256;

/** Generate a random salt (16 bytes) as base64 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufToBase64(salt);
}

/** Derive an AES-GCM key from PIN + salt using PBKDF2 */
async function deriveKey(pin: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const salt = base64ToBuf(saltBase64).buffer as ArrayBuffer;
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Hash PIN with PBKDF2 + salt (iteration-hardened, safe against brute force).
 * Uses pin+":verify" as key material to keep derivation separate from AES key.
 */
export async function hashPIN(pin: string, saltBase64: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin + ":verify"),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64ToBuf(saltBase64).buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verify PIN against a PBKDF2 hash (version 2). Uses constant-time comparison to prevent timing attacks. */
export async function verifyPIN(pin: string, saltBase64: string, storedHash: string): Promise<boolean> {
  const hash = await hashPIN(pin, saltBase64);
  if (hash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * @deprecated Legacy SHA-256 PIN hash — only used for v1→v2 migration.
 * Do NOT use for new PIN setup.
 */
export async function hashPINLegacy(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Encrypt a string with AES-256-GCM. Returns base64(iv + ciphertext) */
export async function encrypt(plaintext: string, pin: string, saltBase64: string): Promise<string> {
  const key = await deriveKey(pin, saltBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return bufToBase64(combined);
}

/** Decrypt a base64(iv + ciphertext) string */
export async function decrypt(ciphertextBase64: string, pin: string, saltBase64: string): Promise<string> {
  const key = await deriveKey(pin, saltBase64);
  const combined = base64ToBuf(ciphertextBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plainBuf);
}

function bufToBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.byteLength; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary);
}

function base64ToBuf(base64: string): Uint8Array {
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf;
}
