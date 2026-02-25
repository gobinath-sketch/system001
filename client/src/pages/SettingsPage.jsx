import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Download, Globe2, KeyRound, ShieldCheck, SlidersHorizontal, UserCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { API_BASE, API_ENDPOINTS } from '../config/api';

const DEFAULT_AVATAR_URL = `${import.meta.env.BASE_URL}profile-default.svg`;
const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024;
const SETTINGS_TEMPORARILY_LOCKED = true;
const SETTINGS_LOCK_VIDEO_SRC = `${import.meta.env.BASE_URL}settings-lock.mp4`;

const defaults = (user) => ({
  profile: { firstName: user?.name?.split(' ')?.[0] || '', lastName: user?.name?.split(' ')?.slice(1).join(' ') || '', email: user?.email || '', language: 'English', timezone: 'Asia/Kolkata', weekStartsOn: 'Monday', avatarDataUrl: user?.avatarDataUrl || '' },
  preferences: { defaultCurrency: 'INR', defaultLanding: 'Dashboard', dateFormat: 'DD/MM/YYYY', numberFormat: 'Indian', savedPresets: [] },
  workspace: { autoLogout: '30m', enableTwoFactor: false, workingHours: '09:00-18:00', alertMode: 'Balanced', lastLocaleSyncAt: null },
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
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devBypass, setDevBypass] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const byQuery = params.get('devSettings') === '1';
    const byLocalStorage = window.localStorage.getItem('settings_dev_mode') === '1';
    setDevBypass(byQuery || byLocalStorage);
  }, []);

  const isSettingsLocked = SETTINGS_TEMPORARILY_LOCKED && !devBypass;

  const profileCompletion = useMemo(() => {
    const checks = [
      settings.profile.firstName,
      settings.profile.lastName,
      settings.profile.email,
      settings.profile.language,
      settings.profile.timezone,
      settings.profile.weekStartsOn
    ];
    const done = checks.filter(Boolean).length;
    return Math.round(done / checks.length * 100);
  }, [settings.profile]);

  const formatDatePreview = useMemo(() => {
    const now = new Date('2026-02-24T10:30:00');
    if (settings.preferences.dateFormat === 'MM/DD/YYYY') {
      return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
    }
    if (settings.preferences.dateFormat === 'YYYY-MM-DD') {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [settings.preferences.dateFormat]);

  const formatNumberPreview = useMemo(() => {
    const value = 1234567.89;
    if (settings.preferences.numberFormat === 'International') {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    }
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }, [settings.preferences.numberFormat]);

  const totalSessions = (settings.security.sessions || []).length;
  const otherSessions = (settings.security.sessions || []).filter((s) => !s.isCurrent).length;

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      addToast(`${label} copied`, 'success');
    } catch {
      addToast('Copy failed', 'error');
    }
  };

  const savePreferencePreset = async () => {
    try {
      const newPreset = {
        name: `Preset ${new Date().toLocaleString('en-IN')}`,
        defaultCurrency: currency,
        defaultLanding: settings.preferences.defaultLanding,
        dateFormat: settings.preferences.dateFormat,
        numberFormat: settings.preferences.numberFormat,
        createdAt: new Date().toISOString()
      };
      const nextPresets = [newPreset, ...(settings.preferences.savedPresets || [])].slice(0, 10);
      const res = await axios.put(`${API_BASE}${API_ENDPOINTS.settings.me}`, {
        preferences: {
          ...settings.preferences,
          defaultCurrency: currency,
          savedPresets: nextPresets
        }
      }, auth);
      syncSettings(res?.data?.settings || {});
      addToast('Preference preset saved.', 'success');
    } catch (e) {
      addToast(e?.response?.data?.message || 'Unable to save preset.', 'error');
    }
  };

  const syncLocale = async () => {
    try {
      const res = await axios.post(`${API_BASE}${API_ENDPOINTS.settings.syncLocale}`, {}, auth);
      syncSettings(res?.data?.settings || {});
      addToast('Locale sync updated.', 'success');
    } catch (e) {
      addToast(e?.response?.data?.message || 'Unable to sync locale.', 'error');
    }
  };

  const exportProfileCard = async () => {
    try {
      const res = await axios.get(`${API_BASE}${API_ENDPOINTS.settings.exportProfileCard}`, {
        ...auth,
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `profile-card-${user?.id || 'user'}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      addToast('Profile card exported.', 'success');
    } catch (e) {
      addToast(e?.response?.data?.message || 'Unable to export profile card.', 'error');
    }
  };

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

  if (loading) {
    return <div className="p-3 sm:p-6 bg-bg-page h-full">
      <div className="max-w-6xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center text-slate-600">Loading settings...</div>
    </div>;
  }

  return <div className="relative p-3 sm:p-6 bg-bg-page h-full">
    <div className={`w-full max-w-[1500px] mx-auto space-y-4 transition ${isSettingsLocked ? 'blur-[2px] pointer-events-none select-none opacity-80' : ''}`}>
      <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm px-5 py-5">
          <p className="text-[11px] tracking-[0.2em] text-slate-500 uppercase font-semibold">Settings</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h1 className="text-xl font-extrabold text-slate-900">Account Controls</h1>
            <button
              onClick={() => editing ? saveAll() : setEditing(true)}
              className={`h-10 px-4 rounded-lg text-sm font-bold transition ${editing ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-[#0b5cab] text-white hover:bg-[#0d6dcc]'}`}
            >
              {editing ? saving ? 'Saving...' : 'Save' : 'Edit'}
            </button>
          </div>
      </div>

      <main className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
          <section className="relative overflow-hidden rounded-[34px] border-[3px] border-slate-900 bg-white p-4 shadow-lg h-[700px] flex flex-col">
            <div className="pointer-events-none absolute -left-[3px] top-28 h-12 w-1.5 rounded-r bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-24 h-10 w-1.5 rounded-l bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-40 h-14 w-1.5 rounded-l bg-slate-300/80" />
            <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-slate-900" />
            <div className="flex items-center gap-2 mb-4">
              <UserCircle2 size={17} className="text-slate-700" />
              <h2 className="text-base font-extrabold text-slate-900">Profile</h2>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="flex items-center gap-3">
                <img src={settings.profile.avatarDataUrl || DEFAULT_AVATAR_URL} alt="Profile" className="w-16 h-16 rounded-xl border border-slate-300 object-cover" />
                <button onClick={() => fileInputRef.current?.click()} disabled={!editing} aria-label="Upload profile picture" className="h-9 w-9 rounded-lg border border-slate-300 bg-white disabled:opacity-50 hover:bg-slate-50 inline-flex items-center justify-center">
                  <img src={`${import.meta.env.BASE_URL}upload-icon.svg`} alt="Upload" className="w-4 h-4 object-contain" />
                </button>
                <button onClick={() => update('profile', 'avatarDataUrl', '')} disabled={!editing} aria-label="Remove profile picture" className="h-9 w-9 rounded-lg border border-slate-300 bg-white disabled:opacity-50 hover:bg-slate-50 inline-flex items-center justify-center">
                  <img src={`${import.meta.env.BASE_URL}delete-icon.svg`} alt="Delete" className="w-4 h-4 object-contain" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" disabled={!editing} onChange={onUploadAvatar} />
              </div>
              <input disabled={!editing} value={settings.profile.firstName} onChange={(e) => update('profile', 'firstName', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100" placeholder="First Name" />
              <input disabled={!editing} value={settings.profile.lastName} onChange={(e) => update('profile', 'lastName', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100" placeholder="Last Name" />
              <input disabled={!editing} value={settings.profile.email} onChange={(e) => update('profile', 'email', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100" placeholder="Primary Email" />
              <select disabled={!editing} value={settings.profile.language} onChange={(e) => update('profile', 'language', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="English">English</option><option value="Kannada">Kannada</option><option value="Telugu">Telugu</option><option value="Hindi">Hindi</option></select>
              <select disabled={!editing} value={settings.profile.timezone} onChange={(e) => update('profile', 'timezone', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option></select>
              <select disabled={!editing} value={settings.profile.weekStartsOn} onChange={(e) => update('profile', 'weekStartsOn', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="Monday">Monday</option><option value="Sunday">Sunday</option></select>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-bold text-slate-700">Profile Completeness</span>
                  <span className="font-extrabold text-slate-900">{profileCompletion}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#0b5cab]" style={{ width: `${profileCompletion}%` }} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <p className="font-bold text-slate-800 mb-1">Quick Tips</p>
                <p>Complete your profile to improve account recovery and notification accuracy.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
                <p className="font-bold text-slate-800">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => copyText(settings.profile.email, 'Email')} className="h-9 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-50">Copy Email</button>
                  <button onClick={() => copyText(`${settings.profile.firstName} ${settings.profile.lastName}`.trim(), 'Name')} className="h-9 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-50">Copy Name</button>
                </div>
                <button onClick={exportProfileCard} className="w-full h-9 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-50">Export Profile Card</button>
              </div>
            </div>
            <div className="pt-3">
              <div className="mx-auto h-1.5 w-28 rounded-full bg-slate-900" />
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[34px] border-[3px] border-slate-900 bg-white p-4 shadow-lg h-[700px] flex flex-col">
            <div className="pointer-events-none absolute -left-[3px] top-28 h-12 w-1.5 rounded-r bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-24 h-10 w-1.5 rounded-l bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-40 h-14 w-1.5 rounded-l bg-slate-300/80" />
            <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-slate-900" />
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={17} className="text-slate-700" />
              <h2 className="text-base font-extrabold text-slate-900">Preferences</h2>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <select disabled={!editing} value={currency} onChange={(e) => { setCurrency(e.target.value); update('preferences', 'defaultCurrency', e.target.value); }} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="INR">INR</option><option value="USD">USD</option></select>
              <select disabled={!editing} value={settings.preferences.defaultLanding} onChange={(e) => update('preferences', 'defaultLanding', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="Dashboard">Dashboard</option><option value="Opportunities">Opportunities</option><option value="Clients">Clients</option></select>
              <select disabled={!editing} value={settings.preferences.dateFormat} onChange={(e) => update('preferences', 'dateFormat', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select>
              <select disabled={!editing} value={settings.preferences.numberFormat} onChange={(e) => update('preferences', 'numberFormat', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="Indian">Indian (12,34,567)</option><option value="International">International (1,234,567)</option></select>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-sm font-bold text-slate-800">Preview</p>
                <div className="text-sm text-slate-700">Date: <span className="font-bold">{formatDatePreview}</span></div>
                <div className="text-sm text-slate-700">Number: <span className="font-bold">{formatNumberPreview}</span></div>
                <div className="text-sm text-slate-700">Currency: <span className="font-bold">{currency}</span></div>
              </div>

              <button
                onClick={savePreferencePreset}
                className="w-full h-10 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50"
              >
                Save As Personal Preset
              </button>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-sm font-bold text-slate-800">Quick Presets</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setCurrency('INR');
                      update('preferences', 'defaultCurrency', 'INR');
                      update('preferences', 'dateFormat', 'DD/MM/YYYY');
                      update('preferences', 'numberFormat', 'Indian');
                    }}
                    className="h-9 rounded-lg border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50"
                  >
                    India
                  </button>
                  <button
                    onClick={() => {
                      setCurrency('USD');
                      update('preferences', 'defaultCurrency', 'USD');
                      update('preferences', 'dateFormat', 'MM/DD/YYYY');
                      update('preferences', 'numberFormat', 'International');
                    }}
                    className="h-9 rounded-lg border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50"
                  >
                    Global
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-sm font-bold text-slate-800">Saved Presets</p>
                <div className="space-y-2">
                  {(settings.preferences.savedPresets || []).slice(0, 3).map((preset, idx) => (
                    <button
                      key={`${preset.name}-${idx}`}
                      onClick={() => {
                        update('preferences', 'defaultCurrency', preset.defaultCurrency);
                        setCurrency(preset.defaultCurrency);
                        update('preferences', 'defaultLanding', preset.defaultLanding);
                        update('preferences', 'dateFormat', preset.dateFormat);
                        update('preferences', 'numberFormat', preset.numberFormat);
                        addToast(`Applied preset: ${preset.name}`, 'success');
                      }}
                      className="w-full h-9 rounded-lg border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50 text-left px-2"
                    >
                      {preset.name}
                    </button>
                  ))}
                  {(settings.preferences.savedPresets || []).length === 0 && (
                    <p className="text-xs text-slate-500">No saved presets yet.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="pt-3">
              <div className="mx-auto h-1.5 w-28 rounded-full bg-slate-900" />
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[34px] border-[3px] border-slate-900 bg-white p-4 shadow-lg h-[700px] flex flex-col">
            <div className="pointer-events-none absolute -left-[3px] top-28 h-12 w-1.5 rounded-r bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-24 h-10 w-1.5 rounded-l bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-40 h-14 w-1.5 rounded-l bg-slate-300/80" />
            <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-slate-900" />
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={17} className="text-slate-700" />
              <h2 className="text-base font-extrabold text-slate-900">Password & Access</h2>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 mb-3">Use a strong password and rotate it periodically.</div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <input type="password" disabled={!editing} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100" placeholder="Current Password" />
              <input type="password" disabled={!editing} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100" placeholder="New Password" />
              <input type="password" disabled={!editing} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100" placeholder="Confirm Password" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={changePassword} disabled={!editing} className="h-10 rounded-xl bg-[#0b5cab] text-white text-sm font-bold hover:bg-[#0d6dcc] disabled:opacity-50">Update</button>
                <button onClick={resetPassword} disabled={!editing} className="h-10 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Reset</button>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-700 mb-2">Active Sessions</p>
                <div className="space-y-2">
                  {(settings.security.sessions || []).map((s) => <div key={s.sessionId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{s.device}{s.isCurrent ? ' (Current)' : ''}</p>
                      <p className="text-xs text-slate-600 truncate">{s.location}</p>
                    </div>
                    {!s.isCurrent && <button onClick={() => revokeSession(s.sessionId)} disabled={!editing} className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50">Sign out</button>}
                  </div>)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-bold text-slate-800 mb-1">Password Strength Checklist</p>
                <ul className="space-y-1 text-slate-700">
                  <li>{passwordForm.newPassword.length >= 8 ? '✓' : '•'} Minimum 8 characters</li>
                  <li>{/[A-Z]/.test(passwordForm.newPassword) ? '✓' : '•'} At least one uppercase letter</li>
                  <li>{/[0-9]/.test(passwordForm.newPassword) ? '✓' : '•'} At least one number</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p className="font-bold text-slate-800">Session Controls</p>
                <p className="text-slate-700">Total sessions: {totalSessions} | Other devices: {otherSessions}</p>
                <button
                  disabled={!editing || otherSessions === 0}
                  onClick={async () => {
                    const targets = (settings.security.sessions || []).filter((s) => !s.isCurrent);
                    for (const item of targets) {
                      // Keep existing revoke flow for each session.
                      // eslint-disable-next-line no-await-in-loop
                      await revokeSession(item.sessionId);
                    }
                  }}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Sign Out All Other Devices
                </button>
              </div>
            </div>
            <div className="pt-3">
              <div className="mx-auto h-1.5 w-28 rounded-full bg-slate-900" />
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[34px] border-[3px] border-slate-900 bg-white p-4 shadow-lg h-[700px] flex flex-col">
            <div className="pointer-events-none absolute -left-[3px] top-28 h-12 w-1.5 rounded-r bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-24 h-10 w-1.5 rounded-l bg-slate-300/80" />
            <div className="pointer-events-none absolute -right-[3px] top-40 h-14 w-1.5 rounded-l bg-slate-300/80" />
            <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-slate-900" />
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={17} className="text-slate-700" />
              <h2 className="text-base font-extrabold text-slate-900">Workspace</h2>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Role: <span className="font-bold">{user?.role || 'Unknown role'}</span></div>
              <select disabled={!editing} value={settings.workspace.autoLogout} onChange={(e) => update('workspace', 'autoLogout', e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 text-[15px] font-semibold bg-white disabled:bg-slate-100"><option value="15m">15 minutes</option><option value="30m">30 minutes</option><option value="1h">1 hour</option><option value="8h">8 hours</option></select>
              <label className="rounded-xl border border-slate-300 bg-white px-3 h-10 flex items-center justify-between text-[15px] font-semibold text-slate-700"><span>Require two-factor authentication</span><input type="checkbox" disabled={!editing} checked={settings.workspace.enableTwoFactor} onChange={(e) => update('workspace', 'enableTwoFactor', e.target.checked)} /></label>
              <button onClick={() => addToast('Data export request queued.', 'info')} className="w-full h-10 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 inline-flex items-center justify-center gap-2"><Download size={14} />Export My Data</button>
              <button onClick={syncLocale} className="w-full h-10 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 inline-flex items-center justify-center gap-2"><Globe2 size={14} />Sync Locale</button>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-bold text-rose-700 inline-flex items-center gap-1.5"><AlertTriangle size={13} />Danger Zone</p>
                <p className="text-sm text-rose-600 mt-1">Sensitive action. Admin confirmation may be required.</p>
                <button onClick={() => addToast('Request submitted to deactivate account. Admin review required.', 'warning')} className="mt-2 h-9 px-3 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700">Request Deactivation</button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-bold text-slate-800 mb-1">Workspace Status</p>
                <p>Last locale sync: {settings.workspace.lastLocaleSyncAt ? new Date(settings.workspace.lastLocaleSyncAt).toLocaleString() : 'Not synced yet'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p className="font-bold text-slate-800">Work Preferences</p>
                <label className="block">
                  <span className="text-slate-700 font-medium">Working hours</span>
                  <select value={settings.workspace.workingHours || '09:00-18:00'} onChange={(e) => update('workspace', 'workingHours', e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-slate-300 bg-white px-2 font-medium">
                    <option value="09:00-18:00">09:00 - 18:00</option>
                    <option value="10:00-19:00">10:00 - 19:00</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-700 font-medium">Alert mode</span>
                  <select value={settings.workspace.alertMode || 'Balanced'} onChange={(e) => update('workspace', 'alertMode', e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-slate-300 bg-white px-2 font-medium">
                    <option value="Balanced">Balanced</option>
                    <option value="Important Only">Important Only</option>
                    <option value="All Alerts">All Alerts</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="pt-3">
              <div className="mx-auto h-1.5 w-28 rounded-full bg-slate-900" />
            </div>
          </section>

      </main>
    </div>
    {isSettingsLocked && <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/35 backdrop-blur-xl shadow-2xl p-4 text-center">
        <video autoPlay loop muted playsInline className="mx-auto w-72 h-44 sm:w-[460px] sm:h-[280px] object-cover rounded-2xl border border-white/70 shadow-lg">
          <source src={SETTINGS_LOCK_VIDEO_SRC} type="video/mp4" />
        </video>
        <p className="mt-3 text-sm font-semibold text-slate-800">Settings is temporarily unavailable.</p>
        <p className="text-xs text-slate-600 mt-1">This is temporary while updates are in progress.</p>
      </div>
    </div>}
  </div>;
}
