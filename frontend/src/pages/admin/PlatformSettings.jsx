import { useEffect, useState } from 'react';
import { adminSettingsAPI } from '../../api/admin';
import toast from 'react-hot-toast';

// ── Platform behaviour settings ───────────────────────────────────────────────
const PLATFORM_SETTINGS = {
    maintenance_mode: {
        label: 'Maintenance Mode',
        description: 'When enabled, all non-admin API requests return 503.',
        type: 'toggle',
    },
    allow_new_registrations: {
        label: 'Allow New Registrations',
        description: 'Block new company and candidate sign-ups when disabled.',
        type: 'toggle',
    },
    email_verify_required: {
        label: 'Email Verification Required',
        description: 'Require users to verify their email before accessing the platform.',
        type: 'toggle',
    },
    cashfree_payment_enabled: {
        label: 'Cashfree Payments Enabled',
        description: 'When disabled, the pay-now flow is hidden from companies.',
        type: 'toggle',
    },
    mail_poller_enabled: {
        label: 'Mail Poller Enabled',
        description: 'Polls the outreach inbox every N minutes to capture campaign replies.',
        type: 'toggle',
    },
    mail_poller_interval_mins: {
        label: 'Mail Poller Interval (mins)',
        description: 'How often the reply inbox is polled. Default: 2.',
        type: 'number',
    },
    max_jobs_per_company: {
        label: 'Max Job Postings per Company',
        description: 'Maximum number of active job postings a single company can have.',
        type: 'number',
    },
    max_resume_size_mb: {
        label: 'Max Resume Size (MB)',
        description: 'Maximum allowed resume upload size.',
        type: 'number',
    },
    ai_match_threshold: {
        label: 'AI Match Threshold (%)',
        description: 'Minimum AI fit score (0–100) for a candidate to appear in matched results.',
        type: 'number',
    },
    offer_validity_days: {
        label: 'Offer Validity (days)',
        description: 'Number of days an offer letter remains valid after being sent.',
        type: 'number',
    },
    platform_name: {
        label: 'Platform Name',
        description: 'Display name used in emails and the UI.',
        type: 'text',
    },
    support_email: {
        label: 'Support Email',
        description: 'Shown to users in system emails.',
        type: 'text',
    },
};

// ── Fees & Billing settings ───────────────────────────────────────────────────
const FEES_SETTINGS = {
    fee_currency: {
        label: 'Default Fee Currency',
        description: 'ISO currency code used for service invoices (e.g. INR, USD).',
        type: 'text',
    },
    placement_fee_currency: {
        label: 'Placement Fee Currency',
        description: 'ISO currency code used for placement fee invoices.',
        type: 'text',
    },
    placement_fee_multiplier: {
        label: 'Placement Fee Multiplier',
        description: 'Multiplier applied to offered CTC to calculate the placement fee (e.g. 1 = 1× monthly CTC).',
        type: 'number',
    },
    candidate_profile_access_fee: {
        label: 'Candidate Profile Access Fee (₹)',
        description: 'Fee charged to companies to unlock full candidate contact details.',
        type: 'number',
    },
    interview_scheduling_fee: {
        label: 'Interview Scheduling Fee (₹)',
        description: 'Fee charged to companies per interview scheduling request.',
        type: 'number',
    },
};

// ── Environment / integration settings ───────────────────────────────────────
const ENV_SECTIONS = [
    {
        id: 'smtp',
        title: 'Transactional Email (SMTP)',
        description: 'Used for password resets, verification, and system notifications.',
        icon: '✉️',
        fields: [
            { key: 'smtp_host',   label: 'SMTP Host',   type: 'text',     placeholder: 'smtpout.secureserver.net' },
            { key: 'smtp_port',   label: 'SMTP Port',   type: 'number',   placeholder: '465' },
            { key: 'smtp_user',   label: 'SMTP User',   type: 'text',     placeholder: 'you@yourdomain.com' },
            { key: 'smtp_pass',   label: 'SMTP Password', type: 'password', placeholder: '••••••••' },
            { key: 'smtp_secure', label: 'Use SSL/TLS', type: 'toggle' },
            { key: 'email_from',  label: 'From Address', type: 'text',    placeholder: '"Platform" <info@yourdomain.com>' },
        ],
    },
    {
        id: 'outreach_smtp',
        title: 'Outreach Email (SMTP)',
        description: 'Dedicated SMTP for cold outreach campaigns. Can be the same as transactional.',
        icon: '📡',
        fields: [
            { key: 'godaddy_smtp_host',        label: 'SMTP Host',     type: 'text',     placeholder: 'smtpout.secureserver.net' },
            { key: 'godaddy_smtp_port',        label: 'SMTP Port',     type: 'number',   placeholder: '465' },
            { key: 'godaddy_smtp_user',        label: 'SMTP User',     type: 'text',     placeholder: 'you@yourdomain.com' },
            { key: 'godaddy_smtp_pass',        label: 'SMTP Password', type: 'password', placeholder: '••••••••' },
            { key: 'godaddy_smtp_secure',      label: 'Use SSL/TLS',   type: 'toggle' },
            { key: 'godaddy_default_from_name', label: 'From Name',    type: 'text',     placeholder: 'LadderStep Human Consulting' },
        ],
    },
    {
        id: 'imap',
        title: 'Reply Inbox (IMAP)',
        description: 'IMAP inbox polled every 2 minutes to capture campaign replies.',
        icon: '📥',
        fields: [
            { key: 'godaddy_imap_host',   label: 'IMAP Host',     type: 'text',     placeholder: 'imap.secureserver.net' },
            { key: 'godaddy_imap_port',   label: 'IMAP Port',     type: 'number',   placeholder: '993' },
            { key: 'godaddy_imap_user',   label: 'IMAP User',     type: 'text',     placeholder: 'you@yourdomain.com' },
            { key: 'godaddy_imap_pass',   label: 'IMAP Password', type: 'password', placeholder: '••••••••' },
            { key: 'godaddy_imap_secure', label: 'Use SSL/TLS',   type: 'toggle' },
        ],
    },
    {
        id: 's3',
        title: 'AWS S3 Storage',
        description: 'Used for resume uploads, masked PDFs, and outreach contact lists.',
        icon: '☁️',
        fields: [
            { key: 'aws_access_key_id',     label: 'Access Key ID',       type: 'text',     placeholder: 'AKIA…' },
            { key: 'aws_secret_access_key', label: 'Secret Access Key',   type: 'password', placeholder: '••••••••' },
            { key: 'aws_region',            label: 'Region',              type: 'text',     placeholder: 'ap-south-1' },
            { key: 'aws_s3_bucket',         label: 'S3 Bucket Name',      type: 'text',     placeholder: 'ladder-consulting-files' },
        ],
    },
    {
        id: 'whatsapp',
        title: 'WhatsApp Cloud API',
        description: 'Meta WhatsApp Business API credentials for campaign messaging.',
        icon: '💬',
        fields: [
            { key: 'whatsapp_phone_number_id',      label: 'Phone Number ID',     type: 'text',     placeholder: '1234567890' },
            { key: 'whatsapp_access_token',         label: 'Access Token',        type: 'password', placeholder: 'EAAxxxxx…' },
            { key: 'whatsapp_business_account_id',  label: 'Business Account ID', type: 'text',     placeholder: '98765…' },
            { key: 'whatsapp_webhook_verify_token', label: 'Webhook Verify Token', type: 'text',    placeholder: 'my-secret-token' },
        ],
    },
    {
        id: 'cashfree',
        title: 'Cashfree Payments',
        description: 'Cashfree payment gateway credentials for invoice collection.',
        icon: '💳',
        fields: [
            { key: 'cashfree_app_id',         label: 'App ID',          type: 'text',     placeholder: 'CF…' },
            { key: 'cashfree_secret_key',     label: 'Secret Key',      type: 'password', placeholder: '••••••••' },
            { key: 'cashfree_env',            label: 'Environment',     type: 'select',   options: ['TEST', 'PROD'] },
            { key: 'cashfree_webhook_secret', label: 'Webhook Secret',  type: 'password', placeholder: '••••••••' },
        ],
    },
    {
        id: 'ai',
        title: 'AI / OpenAI',
        description: 'OpenAI API key — only needed for Training course recommendations. Resume parsing and matching are fully offline.',
        icon: '🤖',
        fields: [
            { key: 'openai_api_key', label: 'OpenAI API Key', type: 'password', placeholder: 'sk-…' },
        ],
    },
];


// ── Sub-components ────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(value === 'true' ? 'false' : 'true')}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            value === 'true' ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value === 'true' ? 'translate-x-6' : 'translate-x-1'
        }`} />
    </button>
);

const FieldInput = ({ field, value, onChange }) => {
    const [show, setShow] = useState(false);

    if (field.type === 'toggle') {
        return <Toggle value={value} onChange={onChange} />;
    }
    if (field.type === 'select') {
        return (
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
                <option value="">— select —</option>
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        );
    }
    if (field.type === 'password') {
        return (
            <div className="flex items-center gap-1">
                <input
                    type={show ? 'text' : 'password'}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                    type="button"
                    onClick={() => setShow(v => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                    title={show ? 'Hide' : 'Show'}
                >
                    {show ? '🙈' : '👁'}
                </button>
            </div>
        );
    }
    return (
        <input
            type={field.type}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
    );
};

// ── Main component ────────────────────────────────────────────────────────────

export default function PlatformSettings() {
    const [settings,   setSettings]   = useState({});
    const [original,   setOriginal]   = useState({});
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [openSection, setOpenSection] = useState(null);

    useEffect(() => {
        adminSettingsAPI.get()
            .then(r => {
                const map = {};
                (r.data?.data || r.data || []).forEach(({ setting_key, value }) => { map[setting_key] = value ?? ''; });
                setSettings(map);
                setOriginal(map);
            })
            .catch(() => toast.error('Failed to load settings'))
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = Object.entries(settings).map(([key, value]) => ({ key, value }));
            await adminSettingsAPI.update({ settings: payload });
            setOriginal(settings);
            toast.success('Settings saved — env overrides applied on next request');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const isDirty = JSON.stringify(settings) !== JSON.stringify(original);

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>;

    return (
        <div className="p-8 max-w-3xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Platform Settings</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure behaviour and integration credentials</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                    className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>

            {isDirty && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg px-4 py-2.5 mb-5 flex items-center gap-2">
                    <span>⚠</span>
                    <span>You have unsaved changes. Click <strong>Save Changes</strong> to apply.</span>
                </div>
            )}

            {/* ── Platform Behaviour ────────────────────────────────────────── */}
            <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform Behaviour</p>
                <div className="space-y-3">
                    {Object.entries(PLATFORM_SETTINGS).map(([key, meta]) => {
                        const value = settings[key] ?? '';
                        return (
                            <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">{meta.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                                </div>
                                <div className="shrink-0">
                                    {meta.type === 'toggle' ? (
                                        <Toggle value={value} onChange={v => handleChange(key, v)} />
                                    ) : (
                                        <input
                                            type={meta.type}
                                            value={value}
                                            onChange={e => handleChange(key, e.target.value)}
                                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Fees & Billing ───────────────────────────────────────────── */}
            <div className="mb-3 mt-8">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Fees & Billing</p>
                <div className="space-y-3">
                    {Object.entries(FEES_SETTINGS).map(([key, meta]) => {
                        const value = settings[key] ?? '';
                        return (
                            <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">{meta.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                                </div>
                                <div className="shrink-0">
                                    <input
                                        type={meta.type}
                                        value={value}
                                        onChange={e => handleChange(key, e.target.value)}
                                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Integration / Env Var Settings ───────────────────────────── */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-8 mb-3">Integration & Environment Variables</p>
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-4 py-2.5 mb-4 flex items-start gap-2">
                <span className="mt-0.5">ℹ</span>
                <span>
                    Values saved here are stored in the database and applied to <code className="bg-blue-100 px-1 rounded">process.env</code> on server startup,
                    overriding the <code className="bg-blue-100 px-1 rounded">.env</code> file. Existing env file values remain as fallbacks.
                </span>
            </div>

            <div className="space-y-3">
                {ENV_SECTIONS.map(section => {
                    const isOpen = openSection === section.id;
                    const filledCount = section.fields.filter(f => settings[f.key] && settings[f.key] !== '').length;
                    const hasChanges = section.fields.some(f => settings[f.key] !== original[f.key]);
                    return (
                        <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setOpenSection(isOpen ? null : section.id)}
                                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                            >
                                <span className="text-lg">{section.icon}</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-800">{section.title}</span>
                                        {hasChanges && (
                                            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">unsaved</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        filledCount === section.fields.length
                                            ? 'bg-green-100 text-green-700'
                                            : filledCount === 0
                                                ? 'bg-gray-100 text-gray-400'
                                                : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {filledCount}/{section.fields.length} set
                                    </span>
                                    <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                                </div>
                            </button>

                            {isOpen && (
                                <div className="px-5 pb-5 border-t border-gray-100 space-y-3 pt-4">
                                    {section.fields.map(field => (
                                        <div key={field.key} className="flex items-center justify-between gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">{field.label}</label>
                                                <p className="text-[10px] font-mono text-gray-400 mt-0.5">{field.key.toUpperCase()}</p>
                                            </div>
                                            <FieldInput
                                                field={field}
                                                value={settings[field.key] ?? ''}
                                                onChange={v => handleChange(field.key, v)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

        </div>
    );
}
