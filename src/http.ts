import type { ApiEnvelope } from "./domain/models";

const COMMON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function jsonResponse<T>(
  request: Request,
  envelope: ApiEnvelope<T>,
  status = 200,
): Promise<Response> {
  const body = JSON.stringify(envelope);
  const etagPayload = JSON.stringify({
    data: envelope.data,
    meta: {
      stale: envelope.meta.stale,
      scheduleUpdatedAt: envelope.meta.scheduleUpdatedAt,
      resultsUpdatedAt: envelope.meta.resultsUpdatedAt,
      driversUpdatedAt: envelope.meta.driversUpdatedAt,
    },
  });
  const etag = `"${await sha256(etagPayload)}"`;

  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(body, {
    status,
    headers: {
      ...COMMON_HEADERS,
      ETag: etag,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}

export function plainJson(data: unknown, status: number, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...COMMON_HEADERS, ...extraHeaders },
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
