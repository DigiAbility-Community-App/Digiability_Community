const encoder = new TextEncoder();

function base64url(arr: Uint8Array): string {
  const bin = Array.from(arr, (byte) => String.fromCharCode(byte)).join("");
  return btoa(bin)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function signJWT(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(encoder.encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(dataToSign)
  );

  const encodedSignature = base64url(new Uint8Array(signature));
  return `${dataToSign}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToVerify = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = fromBase64url(encodedSignature);
    const dataBytes = encoder.encode(dataToVerify);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as any,
      dataBytes as any
    );

    if (!isValid) return null;

    const payloadStr = new TextDecoder().decode(fromBase64url(encodedPayload));
    const payload = JSON.parse(payloadStr);

    // `exp` is REQUIRED. This used to be conditional, which meant a token
    // without an exp claim verified successfully and never expired.
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number") return null;
    if (now > payload.exp) return null; // idle window elapsed

    // Absolute deadline: sliding renewal refreshes `exp`, but never past this,
    // so an active session still can't live forever.
    if (typeof payload.abs === "number" && now > payload.abs) return null;

    return payload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}
