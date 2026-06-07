import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  subscribeToNotifications,
} from '../../services/notifications.service';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    getUnreadCount(user.id).then(setUnreadCount).catch(() => {});
    listNotifications(user.id).then(setNotifications).catch(() => {});

    const unsub = subscribeToNotifications(user.id, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((c) => c + 1);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAll = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClick = async (notif) => {
    if (!notif.read) {
      await markAsRead(notif.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    if (notif.link_url) {
      setOpen(false);
      navigate(notif.link_url);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Math.round((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString();
  };

  const notifIcon = (type) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('verification') || t.includes('kyc')) return { icon: 'verified_user', color: '#d97706' };
    if (t.includes('booking')) return { icon: 'event_note', color: '#2563eb' };
    if (t.includes('payment')) return { icon: 'payments', color: '#059669' };
    if (t.includes('maintenance')) return { icon: 'build', color: '#ea580c' };
    return { icon: 'notifications', color: 'var(--vrs-muted)' };
  };

  return (
    <div ref={ref} className="relative">
      <button
        className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
        onClick={() => setOpen(!open)}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f08f5f] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="vrs-bell-dropdown">
          <div className="vrs-bell-header">
            <div className="vrs-bell-heading">
              Notifications
              {unreadCount > 0 && (
                <span className="vrs-bell-badge-inline">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="vrs-bell-mark-all" title="Mark all read">
                <span className="material-symbols-outlined">done_all</span>
              </button>
            )}
          </div>

          <div className="vrs-bell-list">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--vrs-muted)' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => {
                const ic = notifIcon(notif.type);
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-black/5 ${
                      !notif.read ? 'bg-blue-50/40' : ''
                    }`}
                    style={{ borderColor: 'var(--public-line)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined shrink-0 mt-0.5 text-[18px]" style={{ color: ic.color }}>{ic.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--vrs-text)' }}>
                          {notif.title || notif.message}
                        </p>
                        {notif.body && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--vrs-muted)' }}>
                            {notif.body}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {notif.channel && <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold" style={{ color: 'var(--vrs-muted)' }}>{notif.channel}</span>}
                          <span className="text-[11px]" style={{ color: 'var(--vrs-muted)' }}>
                            {formatTime(notif.created_at)}
                          </span>
                        </div>
                      </div>
                      {!notif.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2c766e]"></span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
