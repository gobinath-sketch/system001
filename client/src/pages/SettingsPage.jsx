import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Download, Globe2, KeyRound, LayoutGrid, ShieldCheck, SlidersHorizontal, UserCircle2 } from 'lucide-react';
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

  const sections = [
    { id: 'profile', label: 'Profile', icon: UserCircle2, subtitle: 'Identity and account details' },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal, subtitle: 'Display and format defaults' },
    { id: 'password', label: 'Password & Access', icon: KeyRound, subtitle: 'Security and active sessions' },
    { id: 'workspace', label: 'Workspace', icon: LayoutGrid, subtitle: 'Organization-level controls' }
  ];

  if (loading) {
    return <div className="p-4 sm:p-6 bg-bg-page h-full">
      <div className="max-w-7xl mx-auto rounded-3xl border border-[#d9e2ef] bg-white/90 shadow-sm p-10 text-center text-slate-600">Loading settings...</div>
    </div>;
  }

  return <div className="p-3 sm:p-6 bg-bg-page h-full">
    <div className="max-w-7xl mx-auto">
      <div className="rounded-3xl border border-[#d9e2ef] bg-white shadow-[0_18px_60px_-40px_rgba(12,38,74,0.45)] overflow-hidden">
        <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#d8f0ff_0%,#eef6ff_45%,#f7fafc_100%)] border-b border-[#dbe5f1] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] text-slate-500 uppercase font-semibold">Control Center</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Settings</h1>
              <p className="text-sm text-slate-600 mt-1">Professional account controls with real-time persistence.</p>
            </div>
            <button
              onClick={() => editing ? saveAll() : setEditing(true)}
              className={`h-11 px-5 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 ${editing ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-[#0b5cab] text-white hover:bg-[#0d6dcc]'}`}
            >
              {editing ? saving ? 'Saving Changes...' : 'Save Changes' : 'Enable Editing'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
          <aside className="border-b lg:border-b-0 lg:border-r border-[#e2e8f0] bg-slate-50/65 p-4 sm:p-5">
            <div className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const selected = active === section.id;
                return <button
                  key={section.id}
                  onClick={() => setActive(section.id)}
                  className={`w-full rounded-2xl border text-left p-3.5 transition ${selected ? 'border-sky-300 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white/90'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center ${selected ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{section.subtitle}</p>
                    </div>
                  </div>
                </button>;
              })}
            </div>
          </aside>

          <main className="p-4 sm:p-6 lg:p-8">
            {active === 'profile' && <section className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5">
                <p className="text-sm font-semibold text-slate-900 mb-4">Profile Image</p>
                <div className="flex flex-wrap items-center gap-4">
                  <img src={settings.profile.avatarDataUrl || DEFAULT_AVATAR_URL} alt="Profile" className="w-20 h-20 rounded-xl border border-slate-300 object-cover" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={!editing} aria-label="Upload profile picture" className="h-10 w-10 rounded-lg border border-slate-300 bg-white disabled:opacity-50 hover:bg-slate-50 inline-flex items-center justify-center">
                    <img src={`${import.meta.env.BASE_URL}upload-icon.svg`} alt="Upload" className="w-5 h-5 object-contain" />
                  </button>
                  <button onClick={() => update('profile', 'avatarDataUrl', '')} disabled={!editing} aria-label="Remove profile picture" className="h-10 w-10 rounded-lg border border-slate-300 bg-white disabled:opacity-50 hover:bg-slate-50 inline-flex items-center justify-center">
                    <img src={`${import.meta.env.BASE_URL}delete-icon.svg`} alt="Delete" className="w-5 h-5 object-contain" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" disabled={!editing} onChange={onUploadAvatar} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><span className="text-xs font-medium text-slate-500">First Name</span><input disabled={!editing} value={settings.profile.firstName} onChange={(e) => update('profile', 'firstName', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100" /></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Last Name</span><input disabled={!editing} value={settings.profile.lastName} onChange={(e) => update('profile', 'lastName', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100" /></label>
                <label className="block md:col-span-2"><span className="text-xs font-medium text-slate-500">Primary Email</span><input disabled={!editing} value={settings.profile.email} onChange={(e) => update('profile', 'email', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100" /></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Language</span><select disabled={!editing} value={settings.profile.language} onChange={(e) => update('profile', 'language', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="English">English</option><option value="Kannada">Kannada</option><option value="Telugu">Telugu</option><option value="Hindi">Hindi</option></select></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Preferred Timezone</span><select disabled={!editing} value={settings.profile.timezone} onChange={(e) => update('profile', 'timezone', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option></select></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Week Starts On</span><select disabled={!editing} value={settings.profile.weekStartsOn} onChange={(e) => update('profile', 'weekStartsOn', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="Monday">Monday</option><option value="Sunday">Sunday</option></select></label>
              </div>
            </section>}

            {active === 'preferences' && <section className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><span className="text-xs font-medium text-slate-500">Default Currency</span><select disabled={!editing} value={currency} onChange={(e) => { setCurrency(e.target.value); update('preferences', 'defaultCurrency', e.target.value); }} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="INR">INR</option><option value="USD">USD</option></select></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Default Landing Page</span><select disabled={!editing} value={settings.preferences.defaultLanding} onChange={(e) => update('preferences', 'defaultLanding', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="Dashboard">Dashboard</option><option value="Opportunities">Opportunities</option><option value="Clients">Clients</option></select></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Date Format</span><select disabled={!editing} value={settings.preferences.dateFormat} onChange={(e) => update('preferences', 'dateFormat', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Number Format</span><select disabled={!editing} value={settings.preferences.numberFormat} onChange={(e) => update('preferences', 'numberFormat', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="Indian">Indian (12,34,567)</option><option value="International">International (1,234,567)</option></select></label>
              </div>
            </section>}

            {active === 'password' && <section className="space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">Use a strong password and rotate it periodically for better account security.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2"><span className="text-xs font-medium text-slate-500">Current Password</span><input type="password" disabled={!editing} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100" /></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">New Password</span><input type="password" disabled={!editing} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100" /></label>
                <label className="block"><span className="text-xs font-medium text-slate-500">Confirm Password</span><input type="password" disabled={!editing} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={changePassword} disabled={!editing} className="h-11 px-4 rounded-xl bg-[#0b5cab] text-white text-sm font-semibold hover:bg-[#0d6dcc] disabled:opacity-50">Update Password</button>
                <button onClick={resetPassword} disabled={!editing} className="h-11 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Reset Password</button>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900 mb-3">Active Sessions</p>
                <div className="space-y-2.5">
                  {(settings.security.sessions || []).map((s) => <div key={s.sessionId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.device}{s.isCurrent ? ' (Current)' : ''}</p>
                      <p className="text-xs text-slate-500">{s.location}</p>
                    </div>
                    {!s.isCurrent && <button onClick={() => revokeSession(s.sessionId)} disabled={!editing} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50">Sign out</button>}
                  </div>)}
                </div>
              </div>
            </section>}

            {active === 'workspace' && <section className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-900 inline-flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <div><p className="font-semibold">Role & Access</p><p>{user?.role || 'Unknown role'}</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><span className="text-xs font-medium text-slate-500">Auto Logout</span><select disabled={!editing} value={settings.workspace.autoLogout} onChange={(e) => update('workspace', 'autoLogout', e.target.value)} className="mt-1.5 w-full h-11 border border-slate-300 rounded-xl px-3 bg-white disabled:bg-slate-100"><option value="15m">15 minutes</option><option value="30m">30 minutes</option><option value="1h">1 hour</option><option value="8h">8 hours</option></select></label>
                <label className="rounded-xl border border-slate-300 bg-white px-3 h-11 mt-6 flex items-center justify-between"><span className="text-sm text-slate-700">Require two-factor authentication</span><input type="checkbox" disabled={!editing} checked={settings.workspace.enableTwoFactor} onChange={(e) => update('workspace', 'enableTwoFactor', e.target.checked)} /></label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => addToast('Data export request queued.', 'info')} className="h-11 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-2"><Download size={16} />Export My Data</button>
                <button onClick={() => addToast('Locale sync updated.', 'success')} className="h-11 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-2"><Globe2 size={16} />Sync Locale Settings</button>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700 inline-flex items-center gap-2"><AlertTriangle size={14} />Danger Zone</p>
                <p className="text-xs text-rose-600 mt-1">These actions are sensitive and may require admin confirmation.</p>
                <button onClick={() => addToast('Request submitted to deactivate account. Admin review required.', 'warning')} className="mt-3 h-9 px-3 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Request Account Deactivation</button>
              </div>
            </section>}
          </main>
        </div>
      </div>
    </div>
  </div>;
}
