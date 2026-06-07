import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { upsertProfile, uploadProfileImage } from '../../services/auth.service';

export default function ProfilePanel({ open, onClose }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (profile) setName(profile.full_name || '');
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await upsertProfile(user.id, { full_name: name });
      await refreshProfile();
      setNote({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setNote({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const url = await uploadProfileImage(user.id, file);
      await upsertProfile(user.id, { avatar_url: url });
      await refreshProfile();
      setNote({ type: 'success', text: 'Photo updated.' });
    } catch (err) {
      setNote({ type: 'error', text: err.message });
    }
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
    navigate('/');
  };

  if (!open) return null;

  const avatarUrl = profile?.avatar_url || profile?.profile_image_url;
  const initials = (profile?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[400] bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        data-profile-panel
        className="fixed right-0 top-0 z-[401] w-full max-w-sm h-full overflow-y-auto border-l rounded-l-2xl"
        style={{ animation: 'panelRise 340ms cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <div className="p-6 space-y-6">
          {/* Close */}
          <div className="flex justify-end">
            <button
              data-profile-panel-close
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="profile-photo-shell relative w-24 h-24 rounded-full border-2 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  data-profile-avatar-preview
                  className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                >
                  {initials}
                </div>
              )}
            </div>
            <button
              id="profileFileLabel"
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium underline cursor-pointer"
            >
              Change photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--vrs-muted)' }}>
                Full Name
              </label>
              <input
                id="profileName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border text-sm"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--vrs-muted)' }}>
                Email
              </label>
              <input
                id="profileEmail"
                type="email"
                value={user?.email || ''}
                readOnly
                className="w-full px-3 py-2.5 rounded-lg border text-sm opacity-70 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Note */}
          {note && (
            <div
              id="profileNote"
              className={`profile-note--${note.type} px-4 py-3 rounded-lg border-l-4 text-sm`}
            >
              {note.text}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              id="saveProfile"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #d9884f, #c8763f)' }}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
            <button
              id="logoutBtn"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-lg text-sm font-semibold border transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
