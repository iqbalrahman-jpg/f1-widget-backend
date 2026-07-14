import { ResourceUnavailableError } from "./cache/cache";
import type { Env } from "./env";
import { jsonResponse, plainJson } from "./http";
import { F1Service } from "./service";

const DRIVER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "If-None-Match",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return problem(405, "method_not_allowed", "Only GET requests are supported", false, {
        Allow: "GET, OPTIONS",
      });
    }

    const url = new URL(request.url);
    const service = new F1Service(env, new Date());

    try {
      if (url.pathname === "/healthz") {
        return plainJson(await service.health(), 200, { "Cache-Control": "no-store" });
      }

      if (url.pathname === "/v1/drivers") {
        const search = url.searchParams.get("search");
        if (search !== null && search.length > 80) {
          return problem(400, "invalid_search", "search must not exceed 80 characters", false);
        }
        return jsonResponse(request, await service.drivers(search));
      }

      if (url.pathname === "/v1/races/next") {
        return jsonResponse(request, await service.nextRace());
      }

      if (url.pathname === "/v1/races/season-progress") {
        return jsonResponse(request, await service.seasonProgress());
      }

      if (url.pathname === "/v1/widget-snapshot") {
        const driverId = url.searchParams.get("driverId");
        if (!driverId || !DRIVER_ID_PATTERN.test(driverId)) {
          return problem(
            400,
            "invalid_driver_id",
            "driverId is required and must contain only letters, numbers, underscores, or hyphens",
            false,
          );
        }
        return jsonResponse(request, await service.widgetSnapshot(driverId));
      }

      return problem(404, "not_found", "Endpoint not found", false);
    } catch (error) {
      if (error instanceof ResourceUnavailableError) {
        return problem(
          503,
          "upstream_unavailable",
          `${error.resource} data is temporarily unavailable`,
          true,
        );
      }
      console.error("Unhandled request error", error);
      return problem(500, "internal_error", "An unexpected error occurred", true);
    }
  },
};

function problem(
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  headers: HeadersInit = {},
): Response {
  return plainJson({ code, message, retryable }, status, headers);
}
