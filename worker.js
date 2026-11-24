import { onRequestGet as resolveFacebook } from "./functions/api/resolve-facebook.js";
import { onRequestGet as resolveTikTok } from "./functions/api/resolve-tiktok.js";

function methodNotAllowed() {
  return new Response(JSON.stringify({ error: "Method not allowed." }), {
    status: 405,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/resolve-facebook") {
      if (request.method !== "GET") return methodNotAllowed();
      return resolveFacebook({ request, env });
    }

    if (pathname === "/api/resolve-tiktok") {
      if (request.method !== "GET") return methodNotAllowed();
      return resolveTikTok({ request, env });
    }

    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "API endpoint not found." }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
