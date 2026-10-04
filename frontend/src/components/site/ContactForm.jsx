import { useState } from 'react';
import { publicAPI } from '../../api/public';

const EMPTY = { name: '', email: '', phone: '', company: '', message: '', website: '' };
const input = 'w-full px-4 py-2 border border-sitegray rounded-lg focus:ring-2 focus:ring-site focus:border-transparent focus:outline-none';
const label = 'block text-sm font-medium text-sitegray-dark mb-2';

export default function ContactForm() {
    const [form, setForm] = useState(EMPTY);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message }

    const change = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (status) setStatus(null);
    };

    const submit = async (e) => {
        e.preventDefault();
        setSending(true);
        setStatus(null);
        try {
            const { data } = await publicAPI.contact(form);
            setStatus({ type: 'success', message: data.message || 'Thank you for your message! We will get back to you soon.' });
            setForm(EMPTY);
        } catch (err) {
            const d = err.response?.data;
            setStatus({
                type: 'error',
                message: (typeof d === 'object' && d?.message) || 'We could not send your message. Please try again later.',
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="name" className={label}>Name *</label>
                    <input id="name" name="name" type="text" required maxLength={100} value={form.name} onChange={change} className={input} />
                </div>
                <div>
                    <label htmlFor="email" className={label}>Email *</label>
                    <input id="email" name="email" type="email" required maxLength={150} value={form.email} onChange={change} className={input} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="phone" className={label}>Phone</label>
                    <input id="phone" name="phone" type="tel" maxLength={30} value={form.phone} onChange={change} className={input} />
                </div>
                <div>
                    <label htmlFor="company" className={label}>Company</label>
                    <input id="company" name="company" type="text" maxLength={120} value={form.company} onChange={change} className={input} />
                </div>
            </div>

            <div>
                <label htmlFor="message" className={label}>Message *</label>
                <textarea id="message" name="message" required rows={5} maxLength={3000} value={form.message} onChange={change} className={input} />
            </div>

            {/* Spam trap: invisible to people, bots fill it in. */}
            <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Leave this empty</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={change} />
            </div>

            {status && (
                <div role="status" className={`p-4 rounded-lg border ${status.type === 'success'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-red-50 text-red-800 border-red-200'}`}>
                    {status.message}
                </div>
            )}

            <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center justify-center font-sitehead font-semibold rounded-lg px-8 py-4 text-lg bg-site text-white hover:bg-site-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-site transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {sending ? 'Sending...' : 'Send Message'}
            </button>
        </form>
    );
}
