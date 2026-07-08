import { useEffect, useState } from 'react';
import { companyAPI } from '../../api/company';
import PackagePicker from '../../components/company/PackagePicker';

const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

// ── Phone collection modal ────────────────────────────────────────────────────
// Shown automatically when the company account has no phone number on file.
function PhoneModal({ onSave }) {
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr]     = useState('');

    const submit = async (e) => {
        e.preventDefault();
        const cleaned = phone.replace(/\s/g, '');
        if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
            setErr('Enter a valid phone number (digits only, 7–15 chars, optional + prefix).');
            return;
        }
        setSaving(true);
        try {
            await companyAPI.updateProfile({ contact_phone: cleaned });
            onSave();
        } catch {
            setErr('Could not save. Please try again.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Phone number required</h2>
                <p className="text-sm text-gray-500 mb-5">
                    A contact phone number is required for your company account. Please add one to continue.
                </p>
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setErr(''); }}
                            placeholder="+91 98765 43210"
                            required
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
                    </div>
                    <button
                        type="submit"
                        disabled={saving || !phone.trim()}
                        className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
                    >
                        {saving ? 'Saving…' : 'Save & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function CompanyProfile() {
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [msg,      setMsg]      = useState({ type: '', text: '' });
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [form, setForm] = useState({
        company_name: '', industry: '', size: '', website: '',
        headquarters: '', description: '', contact_phone: '',
    });

    useEffect(() => {
        companyAPI.getProfile()
            .then(({ data }) => {
                const c = data.company || {};
                const phone = c.contact_phone || '';
                setForm({
                    company_name:  c.company_name  || '',
                    industry:      c.industry      || '',
                    size:          c.size          || '',
                    website:       c.website       || '',
                    headquarters:  c.headquarters  || '',
                    description:   c.description   || '',
                    contact_phone: phone,
                });
                // Auto-prompt if phone is missing
                if (!phone) setShowPhoneModal(true);
            })
            .catch(() => setMsg({ type: 'error', text: 'Failed to load profile.' }))
            .finally(() => setLoading(false));
    }, []);

    const flash = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: '', text: '' }), 4000);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.contact_phone?.trim()) {
            setShowPhoneModal(true);
            return;
        }
        setSaving(true);
        try {
            await companyAPI.updateProfile(form);
            flash('success', 'Profile updated successfully!');
        } catch (err) {
            flash('error', err.response?.data?.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading profile...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            {showPhoneModal && (
                <PhoneModal
                    onSave={() => {
                        setShowPhoneModal(false);
                        // reload profile so the phone field reflects the saved value
                        companyAPI.getProfile().then(({ data }) => {
                            setForm(prev => ({ ...prev, contact_phone: data.company?.contact_phone || '' }));
                        }).catch(() => {});
                    }}
                />
            )}

            <h1 className="text-2xl font-bold text-gray-900 mb-6">Company Profile</h1>

            {msg.text && (
                <div className={`mb-5 rounded-xl px-4 py-3 text-sm border ${
                    msg.type === 'error'
                        ? 'bg-red-50 border-red-200 text-red-600'
                        : 'bg-green-50 border-green-200 text-green-700'
                }`}>
                    {msg.text}
                </div>
            )}

            <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
                        <input value={form.company_name} onChange={f('company_name')} required
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone *</label>
                        <input
                            type="tel"
                            value={form.contact_phone}
                            onChange={f('contact_phone')}
                            placeholder="+91 98765 43210"
                            required
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
                        <input value={form.industry} onChange={f('industry')} placeholder="e.g. Technology, Finance"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Company Size</label>
                        <select value={form.size} onChange={f('size')}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Select size</option>
                            {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
                        <input type="url" value={form.website} onChange={f('website')} placeholder="https://yourcompany.com"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Headquarters</label>
                        <input value={form.headquarters} onChange={f('headquarters')} placeholder="e.g. Bangalore, India"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Company Description</label>
                        <textarea value={form.description} onChange={f('description')} rows={4}
                            placeholder="What does your company do? What makes it a great place to work?"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                </div>

                <button type="submit" disabled={saving}
                    className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </form>

            <div className="mt-6">
                <PackagePicker />
            </div>
        </div>
    );
}
