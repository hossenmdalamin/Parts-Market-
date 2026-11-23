const ALLOWED_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
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
      headers: { "accept": "application/json", "user-agent": "Mozilla/5.0 (compatible; PartsMarketEmbed/2.1)" }
    });

    if (!response.ok) {
      const bodyText = await response.text();
      let metaError = null;
      try {
        const parsed = JSON.parse(bodyText);
        const e = parsed?.error;
        if (e && typeof e === "object") {
          metaError = {
            message: typeof e.message === "string" ? e.message.slice(0, 500) : undefined,
            type: typeof e.type === "string" ? e.type : undefined,
            code: Number.isFinite(e.code) ? e.code : undefined,
            error_subcode: Number.isFinite(e.error_subcode) ? e.error_subcode : undefined,
            fbtrace_id: typeof e.fbtrace_id === "string" ? e.fbtrace_id : undefined,
            user_title: typeof e.error_user_title === "string" ? e.error_user_title.slice(0, 300) : undefined,
            user_message: typeof e.error_user_msg === "string" ? e.error_user_msg.slice(0, 500) : undefined
          };
        }
      } catch {
        // Keep a short, sanitized response excerpt when Meta does not return JSON.
      }
      return json({
        error: "Meta could not create an embed for this video.",
        status: response.status,
        metaError,
        responseExcerpt: metaError ? undefined : bodyText.slice(0, 500)
      }, 422);
    }

    const data = await response.json();
    const match = String(data?.html || "").match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!match) return json({ error: "Meta did not return an iframe embed for this video." }, 422);

    const src = new URL(match[1].replace(/&amp;/g, "&"));
    if (src.protocol !== "https:" || !["facebook.com", "www.facebook.com"].includes(src.hostname.toLowerCase())) {
      return json({ error: "Meta returned an unsupported embed URL." }, 502);
    }
    return json({ src: src.href });
  } catch (error) {
    return json({ error: "Facebook embed lookup failed.", detail: String(error?.message || error).slice(0, 300) }, 502);
  }
}
