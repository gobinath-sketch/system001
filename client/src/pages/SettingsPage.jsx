import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,

    Download,
    Edit3,
    Globe2,
    KeyRound,
    LayoutGrid,
    Laptop,
    RotateCcw,
    Save,
    ShieldCheck,
    UserCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../context/ToastContext';

const SETTINGS_KEY_PREFIX = 'app_settings_v2';

const getSettingsKey = (user) => {
    const identity = user?.id || user?.email || user?.name || 'anonymous';
    return `${SETTINGS_KEY_PREFIX}:${String(identity).toLowerCase()}`;
};

const DEFAULT_SETTINGS = (user) => ({
    profile: {
        firstName: user?.name?.split(' ')?.[0] || '',
        lastName: user?.name?.split(' ')?.slice(1).join(' ') || '',
        email: user?.email || '',
        backupEmail: '',
        phone: '',
        designation: '',
        department: '',
        language: 'English',
        timezone: 'Asia/Kolkata',
        weekStartsOn: 'Monday',
        avatarDataUrl: ''
    },

    preferences: {
        compactTables: false,
        reducedMotion: false,
        defaultLanding: 'Dashboard',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: 'Indian',
        defaultRows: '25'
    },
    workspace: {
        autoLogout: '30m',
        enableTwoFactor: false
    }
});

const loadSettings = (user) => {
    const raw = localStorage.getItem(getSettingsKey(user));
    if (!raw) return DEFAULT_SETTINGS(user);
    try {
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_SETTINGS(user),
            ...parsed,
            profile: { ...DEFAULT_SETTINGS(user).profile, ...(parsed.profile || {}) },

            preferences: { ...DEFAULT_SETTINGS(user).preferences, ...(parsed.preferences || {}) },
            workspace: { ...DEFAULT_SETTINGS(user).workspace, ...(parsed.workspace || {}) }
        };
    } catch {
        return DEFAULT_SETTINGS(user);
    }
};

const sectionGroups = [
    {
        title: 'Personal',
        items: [
            { id: 'profile', label: 'Profile', icon: UserCircle2 },
            { id: 'preferences', label: 'Preferences', icon: LayoutGrid },

        ]
    },
    {
        title: 'Security',
        items: [
            { id: 'password', label: 'Password & Access', icon: KeyRound },
            { id: 'workspace', label: 'Workspace Settings', icon: ShieldCheck }
        ]
    }
];

const SettingsPage = () => {
    const { user } = useAuth();
    const { currency, setCurrency } = useCurrency();
    const { addToast } = useToast();
    const fileInputRef = useRef(null);
    const settingsKey = useMemo(() => getSettingsKey(user), [user?.id, user?.email, user?.name]);

    const [settings, setSettings] = useState(() => loadSettings(user));
    const [activeSection, setActiveSection] = useState('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [sessions, setSessions] = useState([
        { id: 1, device: 'Windows - Chrome', location: 'Chennai, IN', lastSeen: 'Active now' },
        { id: 2, device: 'Android App', location: 'Chennai, IN', lastSeen: '2 hours ago' }
    ]);
    const saveAll = () => {
        setIsSaving(true);
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        window.dispatchEvent(new Event('settings-updated'));
        setTimeout(() => {
            setIsSaving(false);
            setIsEditing(false);
            addToast('Settings saved successfully.', 'success');
        }, 300);
    };

    useEffect(() => {
        setSettings(loadSettings(user));
    }, [settingsKey, user]);

    const handleEditSave = () => {
        if (!isEditing) {
            setIsEditing(true);
            return;
        }
        saveAll();
    };

    const updateSection = (section, field, value) => {
        setSettings((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const onAvatarUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowed.includes(file.type)) {
            addToast('Please upload JPG, PNG, GIF, or WEBP image.', 'warning');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            addToast('Image size should be less than 50MB.', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            updateSection('profile', 'avatarDataUrl', String(reader.result || ''));
            addToast('Profile picture updated.', 'success');
        };
        reader.readAsDataURL(file);
    };

    const removeAvatar = () => {
        if (!settings.profile.avatarDataUrl) return;
        if (!window.confirm('Remove profile picture?')) return;
        updateSection('profile', 'avatarDataUrl', '');
        addToast('Profile picture removed.', 'info');
    };

    const updatePassword = () => {
        const { currentPassword, newPassword, confirmPassword } = passwordForm;
        if (!currentPassword || !newPassword || !confirmPassword) {
            addToast('Please fill all password fields.', 'warning');
            return;
        }
        if (newPassword.length < 8) {
            addToast('New password must be at least 8 characters.', 'warning');
            return;
        }
        if (newPassword !== confirmPassword) {
            addToast('Confirm password does not match.', 'error');
            return;
        }
        if (!window.confirm('Do you want to update your password now?')) return;

        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        addToast('Password updated successfully.', 'success');
    };

    const resetPassword = () => {
        if (!window.confirm('Send a password reset link to your email?')) return;
        addToast(`Reset link sent to ${settings.profile.email || user?.email || 'your email'}.`, 'info');
    };

    const revokeSession = (id) => {
        if (!window.confirm('Sign out this device session?')) return;
        setSessions((prev) => prev.filter((s) => s.id !== id));
        addToast('Session removed.', 'success');
    };

    return (
        <div className="p-3 sm:p-6 bg-bg-page h-full">
            <div className="max-w-7xl mx-auto">
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[74vh]">
                        <aside className="border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/70 p-4">
                            <h1 className="text-xl font-bold text-gray-900 mb-4">Settings</h1>
                            {sectionGroups.map((group) => (
                                <div key={group.title} className="mb-5">
                                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{group.title}</p>
                                    <div className="space-y-1">
                                        {group.items.map((item) => {
                                            const Icon = item.icon;
                                            const active = activeSection === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setActiveSection(item.id)}
                                                    className={`w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-2 transition ${active
                                                        ? 'bg-white border border-gray-200 shadow-sm text-gray-900'
                                                        : 'text-gray-700 hover:bg-white'
                                                        }`}
                                                >
                                                    <Icon size={15} />
                                                    <span className="text-sm font-medium">{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </aside>

                        <main className="p-4 sm:p-6 lg:p-8">
                            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {sectionGroups.flatMap((g) => g.items).find((i) => i.id === activeSection)?.label || 'Settings'}
                                    </h2>
                                </div>
                                <button
                                    onClick={handleEditSave}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition ${isEditing
                                        ? 'bg-primary-blue hover:bg-primary-blue-light'
                                        : 'bg-green-600 hover:bg-green-700'
                                        }`}
                                >
                                    {isEditing ? <Save size={16} /> : <Edit3 size={16} />}
                                    {isEditing ? (isSaving ? 'Saving...' : 'Save Changes') : 'Edit Changes'}
                                </button>
                            </div>

                            {activeSection === 'profile' && (
                                <section className="space-y-5">
                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="w-20 h-20 rounded-md overflow-hidden bg-gray-200 border border-gray-300 shrink-0">
                                                <img
                                                    src={settings.profile.avatarDataUrl || '/profile-default.svg'}
                                                    alt="Profile"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={!isEditing}
                                                        aria-label="Upload profile picture"
                                                        title="Upload profile picture"
                                                        className="inline-flex items-center justify-center h-10 w-10 text-gray-900 hover:opacity-80 disabled:opacity-50"
                                                    >
                                                        <img src="/upload-icon.svg" alt="Upload" className="w-6 h-6 object-contain scale-125 origin-center" />
                                                    </button>
                                                    <button
                                                        onClick={removeAvatar}
                                                        disabled={!isEditing}
                                                        aria-label="Remove profile picture"
                                                        title="Remove profile picture"
                                                        className="inline-flex items-center justify-center h-10 w-10 text-gray-700 hover:opacity-80 disabled:opacity-50"
                                                    >
                                                        <img src="/delete-icon.svg" alt="Delete" className="w-6 h-6 object-contain scale-125 origin-center" />
                                                    </button>
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        disabled={!isEditing}
                                                        onChange={onAvatarUpload}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-xs text-gray-500">First Name</span>
                                            <input
                                                value={settings.profile.firstName}
                                                onChange={(e) => updateSection('profile', 'firstName', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Last Name</span>
                                            <input
                                                value={settings.profile.lastName}
                                                onChange={(e) => updateSection('profile', 'lastName', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            />
                                        </label>
                                        <label className="block md:col-span-2">
                                            <span className="text-xs text-gray-500">Primary Email</span>
                                            <div className="mt-1 flex items-center gap-2">
                                                <input
                                                    value={settings.profile.email}
                                                    onChange={(e) => updateSection('profile', 'email', e.target.value)}
                                                    disabled={!isEditing}
                                                    className="w-full h-11 border border-gray-300 rounded-lg px-3"
                                                />
                                                <button
                                                    onClick={() => addToast('Email change flow can be linked with backend verification.', 'info')}
                                                    disabled={!isEditing}
                                                    className="h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                                                >
                                                    Change
                                                </button>
                                            </div>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Language</span>
                                            <select
                                                value={settings.profile.language}
                                                onChange={(e) => updateSection('profile', 'language', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="English">English</option>
                                                <option value="Kannada">Kannada</option>
                                                <option value="Telugu">Telugu</option>
                                                <option value="Hindi">Hindi</option>
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Preferred Timezone</span>
                                            <select
                                                value={settings.profile.timezone}
                                                onChange={(e) => updateSection('profile', 'timezone', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="Asia/Kolkata">Asia/Kolkata</option>
                                                <option value="UTC">UTC</option>
                                                <option value="America/New_York">America/New_York</option>
                                                <option value="Europe/London">Europe/London</option>
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Week Starts On</span>
                                            <select
                                                value={settings.profile.weekStartsOn}
                                                onChange={(e) => updateSection('profile', 'weekStartsOn', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="Monday">Monday</option>
                                                <option value="Sunday">Sunday</option>
                                            </select>
                                        </label>
                                    </div>
                                </section>
                            )}

                            {activeSection === 'preferences' && (
                                <section className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Default Currency</span>
                                            <select
                                                value={currency}
                                                onChange={(e) => setCurrency(e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="INR">INR</option>
                                                <option value="USD">USD</option>
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Default Landing Page</span>
                                            <select
                                                value={settings.preferences.defaultLanding}
                                                onChange={(e) => updateSection('preferences', 'defaultLanding', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="Dashboard">Dashboard</option>
                                                <option value="Opportunities">Opportunities</option>
                                                <option value="Clients">Clients</option>
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Date Format</span>
                                            <select
                                                value={settings.preferences.dateFormat}
                                                onChange={(e) => updateSection('preferences', 'dateFormat', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Number Format</span>
                                            <select
                                                value={settings.preferences.numberFormat}
                                                onChange={(e) => updateSection('preferences', 'numberFormat', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="Indian">Indian (12,34,567)</option>
                                                <option value="International">International (1,234,567)</option>
                                            </select>
                                        </label>
                                    </div>
                                </section>
                            )}



                            {activeSection === 'password' && (
                                <section className="space-y-5">
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        Use a strong password and rotate it periodically for better account security.
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="block md:col-span-2">
                                            <span className="text-xs text-gray-500">Current Password</span>
                                            <input
                                                type="password"
                                                value={passwordForm.currentPassword}
                                                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">New Password</span>
                                            <input
                                                type="password"
                                                value={passwordForm.newPassword}
                                                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Confirm Password</span>
                                            <input
                                                type="password"
                                                value={passwordForm.confirmPassword}
                                                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            />
                                        </label>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={updatePassword}
                                            disabled={!isEditing}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-blue text-white font-semibold hover:bg-primary-blue-light"
                                        >
                                            <KeyRound size={16} />
                                            Update Password
                                        </button>
                                        <button
                                            onClick={resetPassword}
                                            disabled={!isEditing}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <RotateCcw size={16} />
                                            Reset Password
                                        </button>
                                    </div>

                                    <div className="rounded-lg border border-gray-200 p-4">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Sessions</h3>
                                        <div className="space-y-2">
                                            {sessions.map((session) => (
                                                <div key={session.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <Laptop size={15} className="text-gray-600" />
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-800">{session.device}</p>
                                                            <p className="text-xs text-gray-500">{session.location} â€¢ {session.lastSeen}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => revokeSession(session.id)}
                                                        disabled={!isEditing}
                                                        className="text-xs font-semibold text-red-600 hover:underline"
                                                    >
                                                        Sign out
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {activeSection === 'workspace' && (
                                <section className="space-y-4">
                                    <div className="border border-blue-100 bg-blue-50 rounded-lg p-3 text-sm text-blue-900 flex items-start gap-2">
                                        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold">Role & Access</p>
                                            <p>{user?.role || 'Unknown role'}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-xs text-gray-500">Auto Logout</span>
                                            <select
                                                value={settings.workspace.autoLogout}
                                                onChange={(e) => updateSection('workspace', 'autoLogout', e.target.value)}
                                                disabled={!isEditing}
                                                className="mt-1 w-full h-11 border border-gray-300 rounded-lg px-3"
                                            >
                                                <option value="15m">15 minutes</option>
                                                <option value="30m">30 minutes</option>
                                                <option value="1h">1 hour</option>
                                                <option value="8h">8 hours</option>
                                            </select>
                                        </label>
                                        <div className="block">
                                            <span className="text-xs text-transparent select-none">Auto Logout</span>
                                            <label className="mt-1 flex items-center justify-between border border-gray-300 rounded-lg px-3 h-11">
                                                <span className="text-sm font-medium text-gray-700">Require two-factor authentication</span>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.workspace.enableTwoFactor}
                                                    onChange={(e) => updateSection('workspace', 'enableTwoFactor', e.target.checked)}
                                                    disabled={!isEditing}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button
                                            onClick={() => addToast('Data export has been queued. You will receive an email shortly.', 'info')}
                                            className="h-11 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <Download size={16} />
                                            Export My Data
                                        </button>
                                        <button
                                            onClick={() => addToast('Locale sync updated for your workspace.', 'success')}
                                            className="h-11 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <Globe2 size={16} />
                                            Sync Locale Settings
                                        </button>
                                    </div>

                                    <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                                        <p className="text-sm font-semibold text-red-700 inline-flex items-center gap-2">
                                            <AlertTriangle size={14} />
                                            Danger Zone
                                        </p>
                                        <p className="text-xs text-red-600 mt-1">These actions are sensitive and may require admin confirmation.</p>
                                        <button
                                            onClick={() => addToast('Request submitted to deactivate account. Admin review required.', 'warning')}
                                            className="mt-3 px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                                        >
                                            Request Account Deactivation
                                        </button>
                                    </div>
                                </section>
                            )}
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;




