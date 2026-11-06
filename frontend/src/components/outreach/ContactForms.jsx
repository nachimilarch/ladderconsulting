import { useState } from 'react';
import toast from 'react-hot-toast';
import { contactListAPI } from '../../api/outreach';
import { parsePasted } from './parsePasted';

const EMPTY = { full_name: '', email: '', phone: '', whatsapp_number: '', company_name: '', designation: '', city: '' };

const FIELDS = [
    ['full_name', 'Name', 'text'],
    ['email', 'Email', 'email'],
    ['phone', 'Phone', 'tel'],
    ['whatsapp_number', 'WhatsApp number', 'tel'],
    ['company_name', 'Company', 'text'],
    ['designation', 'Designation', 'text'],
    ['city', 'City', 'text'],
];

function Overlay({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">{title}</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
                </div>
                {children}
            </div>
        </div>
    );
}

// Add one contact, or edit an existing one (pass `contact`).
export function ContactModal({ listId, contact, onClose, onSaved }) {
    const editing = !!contact;
    const [form, setForm] = useState(editing ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, contact[k] || ''])) } : EMPTY);
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) await contactListAPI.updateContact(contact.id, form);
            else await contactListAPI.addContact(listId, form);
            toast.success(editing ? 'Contact updated' : 'Contact added');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save the contact');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Overlay title={editing ? 'Edit contact' : 'Add contact'} onClose={onClose}>
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map(([key, label, type]) => (
                    <div key={key} className={key === 'full_name' || key === 'email' ? 'sm:col-span-2' : ''}>
                        <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
                        <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                    </div>
                ))}
                <p className="sm:col-span-2 text-xs text-gray-400">An email address or a phone / WhatsApp number is required.</p>
                <div className="sm:col-span-2 flex gap-3 mt-1">
                    <button type="submit" disabled={saving} className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                        {saving ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
                    </button>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:underline px-3">Cancel</button>
                </div>
            </form>
        </Overlay>
    );
}

// Paste several contacts at once.
export function PasteModal({ listId, onClose, onSaved }) {
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);
    const [skipped, setSkipped] = useState([]);
    const rows = parsePasted(text);

    const submit = async (e) => {
        e.preventDefault();
        if (!rows.length) return toast.error('Paste at least one row');
        setSaving(true);
        try {
            const r = await contactListAPI.addContacts(listId, rows);
            toast.success(r.data.message);
            if (r.data.skipped?.length) { setSkipped(r.data.skipped); onSaved(false); } else onSaved(true);
        } catch (err) {
            const d = err.response?.data;
            if (d?.skipped?.length) setSkipped(d.skipped);
            toast.error(d?.message || 'Could not add the contacts');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Overlay title="Paste several contacts" onClose={onClose}>
            <form onSubmit={submit}>
                <p className="text-xs text-gray-500 mb-2">
                    One contact per line, in this order: <b>Name, Email, Phone, Company, Designation, City</b>.
                    You can copy rows straight from Excel or Google Sheets. Up to 500 at a time.
                </p>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
                    placeholder={'Asha Rao, asha@acme.com, 9876543210, Acme, HR Manager, Pune'}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-green-500" />
                <p className="text-xs text-gray-400 mt-1">{rows.length} row{rows.length === 1 ? '' : 's'} ready</p>
                {skipped.length > 0 && (
                    <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 max-h-32 overflow-y-auto">
                        <p className="font-medium mb-1">Skipped rows</p>
                        {skipped.map((s, i) => <p key={i}>Row {s.row}: {s.reason}</p>)}
                    </div>
                )}
                <div className="flex gap-3 mt-4">
                    <button type="submit" disabled={saving || !rows.length} className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                        {saving ? 'Adding…' : `Add ${rows.length || ''} contact${rows.length === 1 ? '' : 's'}`}
                    </button>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:underline px-3">{skipped.length ? 'Close' : 'Cancel'}</button>
                </div>
            </form>
        </Overlay>
    );
}
