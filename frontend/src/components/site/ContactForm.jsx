import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { publicAPI } from '../../api/public';
import { Plane } from './Brand';
import { StepGlyph } from './ui';
import { businessTypes, enquiryTopics, needOptions } from './siteContent';

const EMPTY = { name: '', company: '', phone: '', email: '', city: '', businessType: '', industry: '', need: '', message: '', website: '' };

// Brand forms: white fields, navy labels, blue focus ring; red only for errors and the submit button.
const field = 'block min-h-[50px] w-full rounded-md border border-[#C9CED8] bg-white px-4 py-3 text-base text-ls-navy placeholder:text-[#8A92A3] transition focus:border-ls-blue focus:outline-none focus:ring-2 focus:ring-ls-blue/30';
const label = 'mb-2 block text-sm font-semibold text-ls-navy';
const req = <span className="text-ls-blue" aria-hidden="true">*</span>;

// A row of pill buttons that works as a radio group: pick one, pick it again to clear.
function ChoiceGroup({ id, label: text, options, value, onChange }) {
    return (
        <div role="radiogroup" aria-labelledby={`${id}-label`}>
            <span id={`${id}-label`} className={label}>{text}</span>
            <div className="flex flex-wrap gap-2.5">
                {options.map((o) => {
                    const on = value === o;
                    return (
                        <button
                            key={o}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onChange(on ? '' : o)}
                            className={`inline-flex min-h-[46px] items-center gap-2 rounded-full border-2 px-5 py-2 text-base font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue ${on
                                ? 'border-ls-navy bg-ls-navy text-white'
                                : 'border-[#C9CED8] bg-white text-ls-navy hover:border-ls-blue hover:text-ls-blue'}`}
                        >
                            {on && <CheckIcon className="h-4 w-4 motion-safe:animate-ls-pop" strokeWidth={3} aria-hidden="true" />}
                            {o}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// The website's contact endpoint takes name, email, phone, company and one message. The extra fields the
// enquiry form collects (city, business type, industry, what they need) are written into the top of that
// message, so they reach the inbox, the admin notification and the Replies screen without a backend change.
function buildMessage(f, topicLabel) {
    const lines = [];
    if (topicLabel) lines.push(`Enquiry: ${topicLabel}`);
    if (f.need) lines.push(`Needs help with: ${f.need}`);
    if (f.businessType) lines.push(`Business type: ${f.businessType}`);
    if (f.industry.trim()) lines.push(`Industry: ${f.industry.trim()}`);
    if (f.city.trim()) lines.push(`City: ${f.city.trim()}`);
    const note = f.message.trim();
    return [lines.join('\n'), note].filter(Boolean).join('\n\n') || 'Website enquiry';
}

export default function ContactForm() {
    const [params] = useSearchParams();
    const topic = enquiryTopics[params.get('topic')] || null;

    const [form, setForm] = useState(() => ({ ...EMPTY, need: topic?.need || '' }));
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message }

    const change = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (status) setStatus(null);
    };

    const pick = (name, value) => {
        setForm((f) => ({ ...f, [name]: value }));
        if (status) setStatus(null);
    };

    const submit = async (e) => {
        e.preventDefault();
        setSending(true);
        setStatus(null);
        try {
            const { data } = await publicAPI.contact({
                name: form.name,
                email: form.email,
                phone: form.phone,
                company: form.company,
                website: form.website,
                message: buildMessage(form, topic?.label),
            });
            setStatus({ type: 'success', message: data.message || 'A consultant will get back to you within one working day.' });
            setForm({ ...EMPTY, need: topic?.need || '' });
        } catch (err) {
            const d = err.response?.data;
            setStatus({
                type: 'error',
                message: (typeof d === 'object' && d?.message) || 'We could not send your enquiry. Please try again later.',
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            {topic && (
                <p className="inline-flex items-center gap-3 border-l-4 border-ls-blue bg-ls-paper px-4 py-3 text-base font-semibold text-ls-navy motion-safe:animate-ls-fade-up">
                    <StepGlyph className="text-ls-blue" />
                    {topic.label}
                </p>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="name" className={label}>Name {req}</label>
                    <input id="name" name="name" type="text" required maxLength={100} autoComplete="name" value={form.name} onChange={change} className={field} />
                </div>
                <div>
                    <label htmlFor="company" className={label}>Company name</label>
                    <input id="company" name="company" type="text" maxLength={120} autoComplete="organization" value={form.company} onChange={change} className={field} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="phone" className={label}>Phone</label>
                    <input id="phone" name="phone" type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={change} className={field} />
                </div>
                <div>
                    <label htmlFor="email" className={label}>Email {req}</label>
                    <input id="email" name="email" type="email" required maxLength={150} autoComplete="email" value={form.email} onChange={change} className={field} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="city" className={label}>City</label>
                    <input id="city" name="city" type="text" maxLength={80} autoComplete="address-level2" value={form.city} onChange={change} className={field} />
                </div>
                <div>
                    <label htmlFor="industry" className={label}>Industry</label>
                    <input id="industry" name="industry" type="text" maxLength={80} value={form.industry} onChange={change} className={field} />
                </div>
            </div>

            <ChoiceGroup id="businessType" label="Business type" options={businessTypes} value={form.businessType} onChange={(v) => pick('businessType', v)} />
            <ChoiceGroup id="need" label="I need help with" options={needOptions} value={form.need} onChange={(v) => pick('need', v)} />

            <div>
                <label htmlFor="message" className={label}>Message</label>
                <textarea id="message" name="message" rows={5} maxLength={2500} value={form.message} onChange={change} className={`${field} resize-y`} />
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
                className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-ls-red px-7 py-3.5 text-[1.1875rem] font-bold text-white transition-colors hover:bg-ls-red-shade focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
                {sending ? 'Sending…' : 'Send Enquiry'}
                {!sending && <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} aria-hidden="true" />}
            </button>
        </form>
    );
}
