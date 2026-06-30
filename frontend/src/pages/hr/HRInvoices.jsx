import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrInvoiceAPI } from '../../api/payments';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const downloadPDF = async (invoiceId, invoiceNumber) => {
    try {
        const res = await api.get(`/invoices/exec/${invoiceId}/pdf`, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url; a.download = `Invoice-${invoiceNumber}.pdf`; a.click();
        URL.revokeObjectURL(url);
    } catch {
        toast.error('Failed to download PDF.');
    }
};

// Searchable company picker — select by name, submit the id
function CompanySelect({ companies, value, onChange }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    const selected = companies.find(c => c.id === value);

    useEffect(() => {
        const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return companies;
        return companies.filter(c =>
            c.company_name.toLowerCase().includes(q) ||
            (c.industry || '').toLowerCase().includes(q)
        );
    }, [companies, query]);

    return (
        <div className="relative" ref={boxRef}>
            <input
                type="text"
                value={open ? query : (selected?.company_name || '')}
                onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
                onFocus={() => { setQuery(''); setOpen(true); }}
                placeholder={companies.length ? 'Search company by name…' : 'No companies assigned to you'}
                required={!value}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selected && !open && (
                <button
                    type="button"
                    onClick={() => { onChange(null); setQuery(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    title="Clear selection"
                >
                    ✕
                </button>
            )}
            {open && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-400">No matching companies.</p>
                    ) : filtered.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition ${
                                c.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                            }`}
                        >
                            <span className="block font-medium">{c.company_name}</span>
                            {(c.industry || c.headquarters) && (
                                <span className="block text-xs text-gray-400">
                                    {[c.industry, c.headquarters].filter(Boolean).join(' · ')}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const STATUS_COLORS = {
    pending:       'bg-yellow-100 text-yellow-700',
    partially_paid:'bg-blue-100 text-blue-700',
    paid:          'bg-green-100 text-green-700',
    overdue:       'bg-red-100 text-red-600',
    cancelled:     'bg-gray-100 text-gray-500',
    waived:        'bg-gray-100 text-gray-500',
};

const TYPE_LABELS = {
    placement_fee:   'Placement Fee',
    partial_payment: 'Partial Payment',
    other_fee:       'Other Fee',
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const EMPTY_FORM = {
    company_id: null, invoice_type: 'placement_fee', amount: '',
    description: '', due_date: '', notes: '',
    candidate_id: '', job_posting_id: '', application_id: '',
};

export default function HRInvoices() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        hrInvoiceAPI.companies()
            .then(r => setCompanies(r.data?.data || []))
            .catch(console.error);
    }, []);

    const load = () => {
        const params = filter ? { status: filter } : {};
        hrInvoiceAPI.list(params)
            .then(r => setInvoices(r.data?.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [filter]);

    const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.company_id) return toast.error('Please select a company.');
        setSaving(true);
        try {
            const payload = {
                company_id: form.company_id,
                invoice_type: form.invoice_type,
                amount: parseFloat(form.amount),
                description: form.description || undefined,
                due_date: form.due_date || undefined,
                notes: form.notes || undefined,
                candidate_id: form.candidate_id ? parseInt(form.candidate_id) : undefined,
                job_posting_id: form.job_posting_id ? parseInt(form.job_posting_id) : undefined,
                application_id: form.application_id ? parseInt(form.application_id) : undefined,
            };
            await hrInvoiceAPI.create(payload);
            toast.success('Invoice created and company notified.');
            setShowNew(false);
            setForm(EMPTY_FORM);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create invoice.');
        } finally {
            setSaving(false);
        }
    };

    const handleMarkPaid = async (id) => {
        if (!window.confirm('Mark this invoice as fully paid (manual payment)?')) return;
        try {
            await hrInvoiceAPI.markPaid(id, { payment_method: 'manual' });
            toast.success('Invoice marked as paid.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark invoice as paid.');
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Raise and manage invoices for your companies</p>
                </div>
                <div className="flex gap-3">
                    <select
                        value={filter}
                        onChange={e => { setFilter(e.target.value); setLoading(true); }}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    <button
                        onClick={() => setShowNew(v => !v)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
                    >
                        + New Invoice
                    </button>
                </div>
            </div>

            {/* New Invoice Form */}
            {showNew && (
                <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6 mb-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Create Invoice</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Company *</label>
                            <CompanySelect
                                companies={companies}
                                value={form.company_id}
                                onChange={(id) => setForm(p => ({ ...p, company_id: id }))}
                            />
                            <p className="text-[10px] text-gray-400 mt-0.5">
                                {companies.length
                                    ? 'Start typing to search your companies by name'
                                    : 'No companies are assigned to you yet — ask an admin to assign one'}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Type *</label>
                            <select value={form.invoice_type} onChange={f('invoice_type')}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="placement_fee">Placement Fee</option>
                                <option value="partial_payment">Partial Payment</option>
                                <option value="other_fee">Other Fee</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (INR) *</label>
                            <input type="number" value={form.amount} onChange={f('amount')} required min="1" step="0.01"
                                placeholder="e.g. 50000"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                            <input type="date" value={form.due_date} onChange={f('due_date')}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea value={form.description} onChange={f('description')} rows={2}
                                placeholder="Invoice description..."
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="md:col-span-2 text-xs text-gray-400">
                            Optional: Candidate ID, Job Posting ID, Application ID (for placement fees)
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Candidate ID</label>
                            <input type="number" value={form.candidate_id} onChange={f('candidate_id')} placeholder="Optional"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Application ID</label>
                            <input type="number" value={form.application_id} onChange={f('application_id')} placeholder="Optional"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="md:col-span-2 flex gap-3">
                            <button type="submit" disabled={saving}
                                className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition">
                                {saving ? 'Creating…' : 'Create Invoice'}
                            </button>
                            <button type="button" onClick={() => setShowNew(false)}
                                className="border border-gray-300 text-gray-600 px-5 py-2 rounded-xl text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : invoices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <p className="text-gray-500 text-sm">No invoices found.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {invoices.map(inv => (
                        <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="font-mono text-xs text-gray-500">{inv.invoice_number}</span>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || 'bg-gray-100'}`}>
                                            {inv.status.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-gray-400">{TYPE_LABELS[inv.invoice_type]}</span>
                                    </div>
                                    <p className="font-semibold text-gray-900 text-lg">{fmtINR(inv.amount)}</p>
                                    <p className="text-sm text-gray-600">{inv.company_name}</p>
                                    {inv.candidate_name && <p className="text-xs text-gray-500">Candidate: {inv.candidate_name}</p>}
                                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                                        <span>Paid: {fmtINR(inv.amount_paid)}</span>
                                        <span>Outstanding: {fmtINR(parseFloat(inv.amount) - parseFloat(inv.amount_paid))}</span>
                                        {inv.due_date && <span>Due: {inv.due_date}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0 items-end">
                                    <button
                                        onClick={() => navigate(`/hr/invoices/${inv.id}`)}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        View Detail →
                                    </button>
                                    <button
                                        onClick={() => downloadPDF(inv.id, inv.invoice_number)}
                                        className="text-xs text-indigo-600 hover:underline"
                                    >
                                        Download PDF
                                    </button>
                                    {['pending', 'partially_paid', 'overdue'].includes(inv.status) && (
                                        <button
                                            onClick={() => handleMarkPaid(inv.id)}
                                            className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition"
                                        >
                                            Mark Paid
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
