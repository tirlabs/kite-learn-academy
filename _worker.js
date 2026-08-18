export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. Extract visitor information
    const ip = request.headers.get("cf-connecting-ip") || "Unknown IP";
    const userAgent = request.headers.get("user-agent") || "Unknown Device";
    
    // Get location data directly from Cloudflare's network
    const city = request.cf?.city || "Unknown City";
    const country = request.cf?.country || "Unknown Country";

    // 2. Format a highly readable message for your screen
    // We ignore common image/css noise and print clear entry statements
    if (!url.pathname.includes(".") || url.pathname.endsWith(".html")) {
      console.log(`📌 [NEW VISITOR] IP: ${ip} | Location: ${city}, ${country} | Path: ${url.pathname} | Device: ${userAgent}`);
    }

    // 3. Serve the website asset
    return env.ASSETS.fetch(request);
  },
};