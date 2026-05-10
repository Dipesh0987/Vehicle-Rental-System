/**
 * Notifications service for the public-facing pages.
 * Reads `notifications` (RLS-scoped to auth.uid()), supports realtime updates
 * via Supabase channels, and wraps the mark_*_read RPCs.
 *
 * Exposed as window.VehicleNotificationService.
 */
(function () {
  "use strict";

  function getClient() {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase client is not loaded.");
    }
    return window.SupabaseClient.init();
  }

  async function listRecent(limit) {
    var max = Number(limit);
    if (!Number.isFinite(max) || max <= 0) max = 20;

    var client = await getClient();

    // RLS makes sure the user only sees their own rows.
    var result = await client
      .from("notifications")
      .select("id,user_id,type,title,body,link_url,metadata,is_admin,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(max);

    if (result.error) {
      throw new Error(result.error.message || "Could not load notifications.");
    }
    return Array.isArray(result.data) ? result.data : [];
  }

  async function countUnread() {
    var client = await getClient();

    var result = await client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);

    if (result.error) {
      // 401/403 errors when signed-out are expected; surface 0 quietly.
      return 0;
    }
    return Number(result.count || 0);
  }

  async function markRead(ids) {
    var idArray = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!idArray.length) return 0;

    var client = await getClient();
    var result = await client.rpc("mark_notifications_read", { p_ids: idArray });
    if (result.error) {
      throw new Error(result.error.message || "Could not mark notifications as read.");
    }
    return Number(result.data || 0);
  }

  async function markAllRead() {
    var client = await getClient();
    var result = await client.rpc("mark_all_notifications_read");
    if (result.error) {
      throw new Error(result.error.message || "Could not mark notifications as read.");
    }
    return Number(result.data || 0);
  }

  function subscribeToChanges(handler) {
    if (typeof handler !== "function") {
      return function () { /* no-op */ };
    }

    var channel = null;
    var unsubscribed = false;

    (async function () {
      try {
        var client = await getClient();
        if (unsubscribed) return;

        // Channel name unique per session so multiple tabs do not collide.
        var name = "notifications-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now());
        channel = client.channel(name)
          .on("postgres_changes",
            { event: "*", schema: "public", table: "notifications" },
            function (payload) {
              try { handler(payload); } catch (_e) { /* ignore handler errors */ }
            })
          .subscribe();
      } catch (_e) {
        // realtime is best-effort; UI falls back to manual refresh
      }
    })();

    return function unsubscribe() {
      unsubscribed = true;
      if (channel) {
        try {
          channel.unsubscribe();
        } catch (_e) { /* ignore */ }
        channel = null;
      }
    };
  }

  window.VehicleNotificationService = {
    listRecent: listRecent,
    countUnread: countUnread,
    markRead: markRead,
    markAllRead: markAllRead,
    subscribeToChanges: subscribeToChanges,
  };
})();
