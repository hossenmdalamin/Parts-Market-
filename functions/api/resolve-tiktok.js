const ALLOWED_HOSTS = new Set([
  "vt.tiktok.com", "vm.tiktok.com", "tiktok.com", "www.tiktok.com",
  "m.tiktok.com", "www.tiktokv.com", "tiktokv.com"
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff"
    }
  });
}

function isAllowed(url) {
  return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
}

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url);
  const raw = incoming.searchParams.get("url");
  if (!raw || raw.length > 2048) return json({ error: "A valid TikTok URL is required." }, 400);

  let current;
  try { current = new URL(raw); } catch { return json({ error: "Invalid URL." }, 400); }
  if (!isAllowed(current)) return json({ error: "Only TikTok links are supported." }, 400);

  try {
    for (let hop = 0; hop < 6; hop++) {
      const response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; PartsMarketVideoResolver/1.0)",
          "accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) return json({ error: "TikTok redirect did not include a destination." }, 502);
        const next = new URL(location, current);
        if (!isAllowed(next)) return json({ error: "TikTok redirected to an unsupported host." }, 502);
        current = next;
        continue;
      }
      let finalUrl = current.toString();
      let id = current.pathname.match(/\/video\/(\d+)/)?.[1];
      if (!id && response.ok) {
        const html = (await response.text()).slice(0, 1500000);
        const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
          || html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i)?.[1];
        if (canonical) {
          const resolved = new URL(canonical.replace(/&amp;/g, "&"), current);
          if (isAllowed(resolved)) {
            finalUrl = resolved.toString();
            id = resolved.pathname.match(/\/video\/(\d+)/)?.[1];
          }
        }
      } else {
        response.body?.cancel();
      }
      if (id) return json({ id, canonicalUrl: finalUrl });
      return json({ error: "Could not find a video ID in the resolved TikTok URL." }, 422);
    }
    return json({ error: "Too many TikTok redirects." }, 502);
  } catch (error) {
    return json({ error: "TikTok link could not be resolved.", detail: String(error?.message || error) }, 502);
  }
}