import { useState } from 'react';
import { ArrowRightIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { publicAPI } from '../../api/public';

const EMPTY = { name: '', email: '', phone: '', company: '', message: '', website: '' };
const field = 'block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-site-deep placeholder:text-slate-400 shadow-sm transition focus:border-site focus:outline-none focus:ring-4 focus:ring-site/10';
const label = 'mb-2 block text-sm font-semibold text-site-deep';

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
        <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="name" className={label}>Name <span className="text-sitegold-dark">*</span></label>
                    <input id="name" name="name" type="text" required maxLength={100} autoComplete="name" placeholder="Your full name" value={form.name} onChange={change} className={field} />
                </div>
                <div>
                    <label htmlFor="email" className={label}>Email <span className="text-sitegold-dark">*</span></label>
                    <input id="email" name="email" type="email" required maxLength={150} autoComplete="email" placeholder="you@company.com" value={form.email} onChange={change} className={field} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="phone" className={label}>Phone</label>
                    <input id="phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="+91" value={form.phone} onChange={change} className={field} />
                </div>
                <div>
                    <label htmlFor="company" className={label}>Company</label>
                    <input id="company" name="company" type="text" maxLength={120} autoComplete="organization" placeholder="Your business" value={form.company} onChange={change} className={field} />
                </div>
            </div>

            <div>
                <label htmlFor="message" className={label}>How can we help? <span className="text-sitegold-dark">*</span></label>
                <textarea id="message" name="message" required rows={5} maxLength={3000} placeholder="Tell us about your business and what you would like to achieve." value={form.message} onChange={change} className={`${field} resize-y`} />
            </div>

            {/* Spam trap: invisible to people, bots fill it in. */}
            <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Leave this empty</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={change} />
            </div>

            {status && (
                <div
                    role="status"
                    className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${status.type === 'success'
                        ? 'border-success-200 bg-success-50 text-success-800'
                        : 'border-danger-200 bg-danger-50 text-danger-800'}`}
                >
                    {status.type === 'success'
                        ? <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        : <ExclamationCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />}
                    <span>{status.message}</span>
                </div>
            )}

            <button
                type="submit"
                disabled={sending}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-site px-8 py-4 text-base font-semibold tracking-wide text-white shadow-lg shadow-site/20 transition-all hover:bg-site-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitegold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
                {sending ? 'Sending…' : 'Send message'}
                {!sending && <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
            </button>
            <p className="text-xs text-slate-500">We will get back to you as soon as possible. Your details are used only to respond to your enquiry.</p>
        </form>
    );
}
