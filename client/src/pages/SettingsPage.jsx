import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { API_BASE, API_ENDPOINTS } from '../config/api';

const DEFAULT_AVATAR_URL = `${import.meta.env.BASE_URL}profile-default.svg`;
const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024;

const defaults = (user) => ({
  profile: { firstName: user?.name?.split(' ')?.[0] || '', lastName: user?.name?.split(' ')?.slice(1).join(' ') || '', email: user?.email || '', language: 'English', timezone: 'Asia/Kolkata', weekStartsOn: 'Monday', avatarDataUrl: user?.avatarDataUrl || '' },
  preferences: { defaultCurrency: 'INR', defaultLanding: 'Dashboard', dateFormat: 'DD/MM/YYYY', numberFormat: 'Indian' },
  workspace: { autoLogout: '30m', enableTwoFactor: false },
  security: { sessions: [] }
});

const mergeSettings = (incoming, user) => {
  const d = defaults(user);
  return {
    ...d,
    ...(incoming || {}),
    profile: { ...d.profile, ...(incoming?.profile || {}) },
    preferences: { ...d.preferences, ...(incoming?.preferences || {}) },
    workspace: { ...d.workspace, ...(incoming?.workspace || {}) },
    security: { ...d.security, ...(incoming?.security || {}) }
  };
};

const toDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read image.'));
  reader.readAsDataURL(file);
});

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { addToast } = useToast();
  const { socket } = useSocket();
  const token = useMemo(() => sessionStorage.getItem('token'), [user?.id]);
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const fileInputRef = useRef(null);

  const [settings, setSettings] = useState(() => defaults(user));
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [active, setActive] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const syncSettings = (next) => {
    const merged = mergeSettings(next, user);
    setSettings(merged);
    if (merged?.preferences?.defaultCurrency) setCurrency(merged.preferences.defaultCurrency);
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: { settings: merged } }));
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}${API_ENDPOINTS.settings.me}`, auth);
        if (!cancelled) syncSettings(res?.data?.settings || {});
      } catch {
        if (!cancelled) addToast('Unable to load settings from server.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token, user?.id]);

  useEffect(() => {
    if (!socket) return undefined;
    const onSettingsUpdated = (payload) => syncSettings(payload?.settings || {});
    socket.on('settings_updated', onSettingsUpdated);
    return () => socket.off('settings_updated', onSettingsUpdated);
  }, [socket, user?.id, setCurrency]);

  const update = (section, key, value) => setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));

  const saveAll = async () => {
    setSaving(true);
    try {
      const payload = { ...settings, preferences: { ...settings.preferences, defaultCurrency: currency } };
      const res = await axios.put(`${API_BASE}${API_ENDPOINTS.settings.me}`, payload, auth);
      syncSettings(res?.data?.settings || payload);
      if (res?.data?.user && typeof updateUser === 'function') updateUser(res.data.user);
      setEditing(false);
      addToast('Settings saved successfully.', 'success');
    } catch (e) {
      addToast(e?.response?.data?.message || 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onUploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_UPLOAD_BYTES) { addToast('Image size should be less than 8MB.', 'warning'); return; }
    try { update('profile', 'avatarDataUrl', await toDataUrl(file)); addToast('Profile picture updated.', 'success'); }
    catch { addToast('Unable to process selected image.', 'error'); }
    finally { event.target.value = ''; }
  };

  const changePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) return addToast('Please fill all password fields.', 'warning');
    if (newPassword.length < 8) return addToast('New password must be at least 8 characters.', 'warning');
    if (newPassword !== confirmPassword) return addToast('Confirm password does not match.', 'error');
    try {
      await axios.put(`${API_BASE}${API_ENDPOINTS.settings.password}`, { currentPassword, newPassword, confirmPassword }, auth);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      addToast('Password updated successfully.', 'success');
    } catch (e) { addToast(e?.response?.data?.message || 'Unable to update password.', 'error'); }
  };

  const resetPassword = async () => {
    try { await axios.post(`${API_BASE}${API_ENDPOINTS.settings.resetPassword}`, {}, auth); addToast('Password reset request sent.', 'info'); }
    catch (e) { addToast(e?.response?.data?.message || 'Unable to submit reset request.', 'error'); }
  };

  const revokeSession = async (sessionId) => {
    try {
      const res = await axios.delete(`${API_BASE}${API_ENDPOINTS.settings.sessionById(sessionId)}`, auth);
      syncSettings(res?.data?.settings || {});
      addToast('Session removed.', 'success');
    } catch (e) { addToast(e?.response?.data?.message || 'Unable to remove session.', 'error'); }
  };

  if (loading) return <div className="p-6">Loading settings...</div>;

  return <div className="p-4 sm:p-6 bg-bg-page h-full">
    <div className="max-w-5xl mx-auto rounded-xl border bg-white p-4 sm:p-6">
      <div className="flex flex-wrap gap-2 mb-5">
        {['profile', 'preferences', 'password', 'workspace'].map((id) => <button key={id} onClick={() => setActive(id)} className={`px-3 py-1.5 rounded-md text-sm ${active === id ? 'bg-primary-blue text-white' : 'border text-gray-700'}`}>{id}</button>)}
      </div>

      <div className="mb-4">
        <button onClick={() => editing ? saveAll() : setEditing(true)} className="px-4 py-2 rounded-lg bg-primary-blue text-white">{editing ? (saving ? 'Saving...' : 'Save Changes') : 'Edit Changes'}</button>
      </div>

      {active === 'profile' && <div className="space-y-3">
        <div className="flex items-center gap-3">
          <img src={settings.profile.avatarDataUrl || DEFAULT_AVATAR_URL} alt="Profile" className="w-20 h-20 rounded-md border object-cover" />
          <button onClick={() => fileInputRef.current?.click()} disabled={!editing} className="px-3 py-2 border rounded-md">Upload</button>
          <button onClick={() => update('profile', 'avatarDataUrl', '')} disabled={!editing} className="px-3 py-2 border rounded-md">Remove</button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" disabled={!editing} onChange={onUploadAvatar} />
        </div>
        <input disabled={!editing} value={settings.profile.firstName} onChange={(e) => update('profile', 'firstName', e.target.value)} className="w-full border rounded-md p-2" placeholder="First Name" />
        <input disabled={!editing} value={settings.profile.lastName} onChange={(e) => update('profile', 'lastName', e.target.value)} className="w-full border rounded-md p-2" placeholder="Last Name" />
        <input disabled={!editing} value={settings.profile.email} onChange={(e) => update('profile', 'email', e.target.value)} className="w-full border rounded-md p-2" placeholder="Email" />
        <select disabled={!editing} value={settings.profile.language} onChange={(e) => update('profile', 'language', e.target.value)} className="w-full border rounded-md p-2"><option value="English">English</option><option value="Kannada">Kannada</option><option value="Telugu">Telugu</option><option value="Hindi">Hindi</option></select>
        <select disabled={!editing} value={settings.profile.timezone} onChange={(e) => update('profile', 'timezone', e.target.value)} className="w-full border rounded-md p-2"><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option></select>
        <select disabled={!editing} value={settings.profile.weekStartsOn} onChange={(e) => update('profile', 'weekStartsOn', e.target.value)} className="w-full border rounded-md p-2"><option value="Monday">Monday</option><option value="Sunday">Sunday</option></select>
      </div>}

      {active === 'preferences' && <div className="space-y-3">
        <select disabled={!editing} value={currency} onChange={(e) => { setCurrency(e.target.value); update('preferences', 'defaultCurrency', e.target.value); }} className="w-full border rounded-md p-2"><option value="INR">INR</option><option value="USD">USD</option></select>
        <select disabled={!editing} value={settings.preferences.defaultLanding} onChange={(e) => update('preferences', 'defaultLanding', e.target.value)} className="w-full border rounded-md p-2"><option value="Dashboard">Dashboard</option><option value="Opportunities">Opportunities</option><option value="Clients">Clients</option></select>
        <select disabled={!editing} value={settings.preferences.dateFormat} onChange={(e) => update('preferences', 'dateFormat', e.target.value)} className="w-full border rounded-md p-2"><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select>
        <select disabled={!editing} value={settings.preferences.numberFormat} onChange={(e) => update('preferences', 'numberFormat', e.target.value)} className="w-full border rounded-md p-2"><option value="Indian">Indian (12,34,567)</option><option value="International">International (1,234,567)</option></select>
      </div>}

      {active === 'password' && <div className="space-y-3">
        <input type="password" disabled={!editing} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))} className="w-full border rounded-md p-2" placeholder="Current Password" />
        <input type="password" disabled={!editing} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} className="w-full border rounded-md p-2" placeholder="New Password" />
        <input type="password" disabled={!editing} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))} className="w-full border rounded-md p-2" placeholder="Confirm Password" />
        <div className="flex gap-2"><button onClick={changePassword} disabled={!editing} className="px-3 py-2 bg-primary-blue text-white rounded-md">Update Password</button><button onClick={resetPassword} disabled={!editing} className="px-3 py-2 border rounded-md">Reset Password</button></div>
        <div className="space-y-2">{(settings.security.sessions || []).map((s) => <div key={s.sessionId} className="flex items-center justify-between border rounded-md p-2"><div><p className="text-sm font-semibold">{s.device}{s.isCurrent ? ' (Current)' : ''}</p><p className="text-xs text-gray-500">{s.location}</p></div>{!s.isCurrent && <button onClick={() => revokeSession(s.sessionId)} disabled={!editing} className="text-red-600 text-sm">Sign out</button>}</div>)}</div>
      </div>}

      {active === 'workspace' && <div className="space-y-3">
        <select disabled={!editing} value={settings.workspace.autoLogout} onChange={(e) => update('workspace', 'autoLogout', e.target.value)} className="w-full border rounded-md p-2"><option value="15m">15 minutes</option><option value="30m">30 minutes</option><option value="1h">1 hour</option><option value="8h">8 hours</option></select>
        <label className="flex items-center gap-2"><input type="checkbox" disabled={!editing} checked={settings.workspace.enableTwoFactor} onChange={(e) => update('workspace', 'enableTwoFactor', e.target.checked)} /><span>Require two-factor authentication</span></label>
        <div className="flex gap-2"><button onClick={() => addToast('Data export request queued.', 'info')} className="px-3 py-2 border rounded-md">Export My Data</button><button onClick={() => addToast('Locale sync updated.', 'success')} className="px-3 py-2 border rounded-md">Sync Locale Settings</button></div>
      </div>}
    </div>
  </div>;
}
