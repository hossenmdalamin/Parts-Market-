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

function videoIdFromUrl(value) {
  const path = value.pathname;
  return path.match(/\/video\/(\d{10,25})/)?.[1]
    || path.match(/\/(?:v|player\/v1|embed\/v2)\/(\d{10,25})/)?.[1]
    || null;
}

function videoIdFromOembed(data) {
  const id = String(data?.embed_product_id || "").match(/^\d{10,25}$/)?.[0];
  if (id) return id;
  return String(data?.html || "").match(/player\/v1\/(\d{10,25})/)?.[1] || null;
}

async function requestOembed(videoUrl) {
  const endpoint = "https://www.tiktok.com/oembed?url=" + encodeURIComponent(videoUrl);
  const response = await fetch(endpoint, {
    headers: {
      "accept": "application/json",
      "user-agent": "Mozilla/5.0 (compatible; PartsMarketEmbed/3.0)"
    }
  });
  if (!response.ok) return null;
  return videoIdFromOembed(await response.json());
}

export async function onRequestGet({ request }) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw || raw.length > 2048) return json({ error: "A valid TikTok URL is required." }, 400);

  let original;
  try { original = new URL(raw); } catch { return json({ error: "Invalid URL." }, 400); }
  if (!isAllowed(original)) return json({ error: "Only TikTok links are supported." }, 400);

  try {
    let canonicalUrl = original.href;
    let id = videoIdFromUrl(original);

    // TikTok's oEmbed endpoint expects a video page URL. Expand vt/vm short
    // links first, then ask the official oEmbed endpoint for the video ID.
    if (!id && ["vt.tiktok.com", "vm.tiktok.com"].includes(original.hostname.toLowerCase())) {
      try {
        const redirectResponse = await fetch(original.href, {
          redirect: "follow",
          headers: { "user-agent": "Mozilla/5.0 (compatible; PartsMarketEmbed/3.0)" }
        });
        const finalUrl = new URL(redirectResponse.url || original.href);
        if (!isAllowed(finalUrl)) return json({ error: "TikTok redirected to an unsupported host." }, 502);
        canonicalUrl = finalUrl.href;
        id = videoIdFromUrl(finalUrl);
      } catch (redirectError) {
        // The oEmbed lookup below still gets a chance with the original link.
        console.warn("TikTok short-link redirect failed", String(redirectError?.message || redirectError));
      }
    }

    if (!id) id = await requestOembed(canonicalUrl);
    if (!id && canonicalUrl !== original.href) id = await requestOembed(original.href);

    if (!id) return json({
      error: "TikTok did not return an embeddable video ID for this link.",
      canonicalUrl: canonicalUrl !== original.href ? canonicalUrl : undefined
    }, 422);

    return json({ id, canonicalUrl });
  } catch (error) {
    return json({ error: "TikTok embed lookup failed.", detail: String(error?.message || error).slice(0, 300) }, 502);
  }
}
