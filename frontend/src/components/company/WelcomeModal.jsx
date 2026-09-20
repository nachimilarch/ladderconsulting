const INDUSTRIES = [
    'Technology', 'Finance', 'Banking', 'Healthcare', 'Education', 'Manufacturing',
    'Retail', 'E-commerce', 'Consulting', 'Real Estate', 'Media & Entertainment',
    'Logistics', 'Automotive', 'Energy', 'Hospitality', 'Telecommunications', 'Other',
];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

// First-visit form: collects the details our executives need before the company starts hiring.
export default function WelcomeModal({ form, setForm, saving, onSubmit }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-1">
                        <img src="/logo-icon.png" alt="" className="w-8 h-8 object-contain" />
                        <h2 className="text-lg font-bold text-gray-900">Welcome to LadderStep!</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                        Complete your company profile so our team can best assist you with hiring.
                    </p>
                </div>

                <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name <span className="text-red-500">*</span></label>
                        <input
                            value={form.company_name}
                            onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Acme Corp"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Industry <span className="text-red-500">*</span></label>
                            <select
                                value={form.industry}
                                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select…</option>
                                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Company Size</label>
                            <select
                                value={form.size}
                                onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select…</option>
                                {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Location / Headquarters <span className="text-red-500">*</span></label>
                        <input
                            value={form.headquarters}
                            onChange={e => setForm(f => ({ ...f, headquarters: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Bangalore, Karnataka"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
                            <input
                                value={form.website}
                                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="https://example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Phone <span className="text-red-500">*</span></label>
                            <input
                                type="tel"
                                value={form.contact_phone}
                                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="+91 98765 43210"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">About the Company</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="Brief description of your company, culture, and what you do…"
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                        >
                            {saving ? 'Saving…' : 'Save & Continue'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
