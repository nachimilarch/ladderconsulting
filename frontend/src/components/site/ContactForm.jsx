import { useState } from 'react';
import { ArrowRightIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { publicAPI } from '../../api/public';
import { Plane } from './Brand';

const EMPTY = { name: '', email: '', phone: '', company: '', message: '', website: '' };
// Brand forms: white fields, navy labels, blue focus ring; red only for errors and the submit button.
const field = 'block w-full rounded-md border border-[#C9CED8] bg-white px-4 py-3 text-base text-ls-navy placeholder:text-[#8A92A3] transition focus:border-ls-blue focus:outline-none focus:ring-2 focus:ring-ls-blue/30';
const label = 'mb-2 block text-sm font-semibold text-ls-navy';
const req = <span className="text-ls-blue" aria-hidden="true">*</span>;

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
                    <label htmlFor="name" className={label}>Name {req}</label>
                    <input id="name" name="name" type="text" required maxLength={100} autoComplete="name" placeholder="Your full name" value={form.name} onChange={change} className={field} />
                </div>
                <div>
                    <label htmlFor="email" className={label}>Email {req}</label>
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
                <label htmlFor="message" className={label}>How can we help? {req}</label>
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
                    className={`flex items-start gap-3 rounded-md border p-4 text-sm ${status.type === 'success'
                        ? 'border-ls-line border-l-4 border-l-ls-blue bg-ls-paper text-ls-navy'
                        : 'border-ls-red/40 border-l-4 border-l-ls-red-shade bg-[#FDF2F3] text-ls-red-shade'}`}
                >
                    {status.type === 'success'
                        ? <Plane className="h-5 w-auto shrink-0 motion-safe:animate-ls-takeoff [animation-delay:0s]" />
                        : <ExclamationCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />}
                    <span>{status.message}</span>
                </div>
            )}

            <button
                type="submit"
                disabled={sending}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-ls-red px-7 py-3.5 text-lg font-bold text-white transition-colors hover:bg-ls-red-shade focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
                {sending ? 'Sending…' : 'Send message'}
                {!sending && <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} aria-hidden="true" />}
            </button>
            <p className="text-xs text-ls-muted">We will get back to you as soon as possible. Your details are used only to respond to your enquiry.</p>
        </form>
    );
}
