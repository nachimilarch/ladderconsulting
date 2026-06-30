import { useEffect, useState } from 'react';
import { companyAPI } from '../../api/company';
import PackagePicker from '../../components/company/PackagePicker';

const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function CompanyProfile() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [form, setForm] = useState({
        company_name: '', industry: '', size: '', website: '', headquarters: '', description: '',
    });

    useEffect(() => {
        companyAPI.getProfile()
            .then(({ data }) => {
                const c = data.company || {};
                setForm({
                    company_name:  c.company_name  || '',
                    industry:      c.industry      || '',
                    size:          c.size          || '',
                    website:       c.website       || '',
                    headquarters:  c.headquarters  || '',
                    description:   c.description   || '',
                });
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

                    <div>
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
