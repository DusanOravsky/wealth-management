// NOTE: Binance's REST API (api.binance.com) does NOT support CORS for browser requests.
// The fetchBinanceBalances function will work correctly only when:
//   a) Running via a browser extension that bypasses CORS (e.g. CORS Unblock)
//   b) The user's network routes through a CORS-permissive proxy
//   c) Binance changes their CORS policy
// For production use, holdings should be entered manually in the Crypto section.
import { BINANCE_BASE } from "./constants";

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceAccountInfo {
  balances: BinanceBalance[];
}

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function fetchBinanceBalances(
  apiKey: string,
  apiSecret: string
): Promise<{ asset: string; total: number }[]> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = await hmacSHA256(apiSecret, queryString);

  const url = `${BINANCE_BASE}/api/v3/account?${queryString}&signature=${signature}`;
  const res = await fetch(url, {
    headers: { "X-MBX-APIKEY": apiKey },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Binance error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data: BinanceAccountInfo = await res.json();
  return data.balances
    .map((b) => ({
      asset: b.asset,
      total: parseFloat(b.free) + parseFloat(b.locked),
    }))
    .filter((b) => b.total > 0);
}
