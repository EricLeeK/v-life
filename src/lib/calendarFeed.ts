// Feed-token and URL helpers for the Apple Calendar subscription card.

export function generateFeedToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildFeedUrl(supabaseUrl: string, token: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/calendar-feed?token=${encodeURIComponent(token)}`;
}

// webcal:// makes macOS/iOS hand the link to Calendar.app, which pops its
// subscribe dialog pre-filled (Calendar fetches it over https).
export function buildWebcalUrl(feedUrl: string): string {
  return feedUrl.replace(/^https:\/\//, "webcal://");
}
