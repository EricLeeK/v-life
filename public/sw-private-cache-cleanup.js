// Remove authenticated responses retained by the previous network-first policy.
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("supabase-api"));
});
