const ALLOWED_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"]);

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

export async function onRequestGet({ request }) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw || raw.length > 2048) return json({ error: "A Facebook video URL is required." }, 400);

  let videoUrl;
  try { videoUrl = new URL(raw); } catch { return json({ error: "Invalid URL." }, 400); }
  if (videoUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(videoUrl.hostname.toLowerCase())) {
    return json({ error: "Only Facebook video links are supported." }, 400);
  }

  try {
    const endpoint = "https://graph.facebook.com/v27.0/oembed_video?url="
      + encodeURIComponent(videoUrl.href) + "&maxwidth=720&useiframe=true&omitscript=true";
    const response = await fetch(endpoint, {
      headers: { "accept": "application/json", "user-agent": "Mozilla/5.0 (compatible; PartsMarketEmbed/2.0)" }
    });
    if (!response.ok) return json({ error: "Meta could not create an embed for this video.", status: response.status }, 422);
    const data = await response.json();
    const match = String(data?.html || "").match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!match) return json({ error: "Meta did not return an iframe embed for this video." }, 422);

    const src = new URL(match[1].replace(/&amp;/g, "&"));
    if (src.protocol !== "https:" || !["facebook.com", "www.facebook.com"].includes(src.hostname.toLowerCase())) {
      return json({ error: "Meta returned an unsupported embed URL." }, 502);
    }
    return json({ src: src.href });
  } catch (error) {
    return json({ error: "Facebook embed lookup failed.", detail: String(error?.message || error) }, 502);
  }
}
