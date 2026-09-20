import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { resumeAPI } from '../../api/candidate';

const POLL_MS = 6000;
const GIVE_UP_MS = 6 * 60 * 1000;

const blank = (v) => !String(v ?? '').trim();
const has = (list, value) => list.some((x) => x.toLowerCase() === value.toLowerCase());

// "B.Tech" and "b tech in ECE" should count as the same thing when comparing entries.
const squash = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const overlaps = (a, b) => !!a && !!b && (a.includes(b) || b.includes(a));

// Is this AI education entry already in the form? Same school (allowing "X" vs "X, City"),
// and the same degree or year, or a degree missing on either side.
const sameEducation = (cur, e) => {
    if (!overlaps(squash(cur.institution), squash(e.institution))) return false;
    const d1 = squash(cur.degree);
    const d2 = squash(e.degree);
    return !d1 || !d2 || overlaps(d1, d2) || (!!e.end_year && String(e.end_year) === String(cur.end_year));
};

// The offline parser fills the form first. This card is the AI model's second look at the
// resume: it offers what the rules missed, but only ever fills EMPTY fields and adds new
// skills or education, and nothing is saved until the candidate clicks Save Profile.
// Mount it with key={resumeKey} so a new upload starts fresh.
export default function AiEnrichmentCard({ form, setForm, education, setEducation, skills, setSkills }) {
    const [info, setInfo] = useState(null); // { enabled, has_resume, can_run, status, extract }
    const [dismissed, setDismissed] = useState(false);
    const [starting, setStarting] = useState(false);
    const [tick, setTick] = useState(0);
    const startedAt = useRef(0);

    // Ask for the latest status; while the AI is still working, ask again every few seconds.
    useEffect(() => {
        if (!startedAt.current) startedAt.current = Date.now();
        let cancelled = false;
        let timer;
        resumeAPI.aiEnrichment()
            .then(({ data }) => {
                if (cancelled) return;
                const d = data.data;
                setInfo(d);
                // Keep looking while the AI is working, or while a fresh upload is still being read.
                const waiting = d.status === 'pending' || (d.status === 'none' && d.enabled && d.has_resume && !d.can_run);
                if (waiting && Date.now() - startedAt.current < GIVE_UP_MS) {
                    timer = setTimeout(() => setTick((n) => n + 1), POLL_MS);
                }
            })
            .catch(() => { if (!cancelled) setInfo(null); });
        return () => { cancelled = true; clearTimeout(timer); };
    }, [tick]);

    const start = async () => {
        setStarting(true);
        try {
            await resumeAPI.runAiEnrichment();
            startedAt.current = Date.now();
            setTick((n) => n + 1);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not start the AI check.');
        } finally {
            setStarting(false);
        }
    };

    if (!info || !info.enabled || !info.has_resume || dismissed) return null;

    if (info.status === 'pending') {
        return (
            <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 flex items-center gap-3">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-brand-300 border-t-brand-600 animate-spin shrink-0" aria-hidden="true" />
                <div>
                    <p className="text-sm font-semibold text-gray-800">✨ The AI is taking a second look at your resume</p>
                    <p className="text-xs text-gray-500 mt-0.5">It looks for details the first pass missed. This can take up to a minute; you can keep editing.</p>
                </div>
            </div>
        );
    }

    if (info.status !== 'done') {
        if (!info.can_run) return null;
        return (
            <div className="mb-5 rounded-2xl border border-gray-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-gray-800">✨ Want the AI to look for more details?</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {info.status === 'failed' ? "The last check didn't finish. " : ''}
                        It reads your resume again and suggests a headline, summary, skills and education you can add.
                    </p>
                </div>
                <button
                    type="button" onClick={start} disabled={starting}
                    className="text-sm font-semibold px-4 py-2 rounded-xl border border-brand-200 text-brand-700 bg-white hover:bg-brand-50 disabled:opacity-50 transition"
                >
                    {starting ? 'Starting…' : 'Check with AI'}
                </button>
            </div>
        );
    }

    // ── done: work out what would actually be new ────────────────────────────
    const x = info.extract || {};
    const newSkills = (x.skills || []).filter((s) => !has(skills, s));
    const newEdu = (x.education || []).filter((e) => !education.some((cur) => sameEducation(cur, e)));
    const fields = [
        blank(form.headline) && x.headline ? ['headline', 'Headline', x.headline] : null,
        blank(form.summary) && x.summary ? ['summary', 'Summary', x.summary] : null,
        blank(form.location) && x.location ? ['location', 'Location', x.location] : null,
        blank(form.total_experience) && x.experience_years != null ? ['total_experience', 'Experience', `${x.experience_years} years`] : null,
    ].filter(Boolean);

    if (!fields.length && !newSkills.length && !newEdu.length) {
        return (
            <div className="mb-5 rounded-2xl border border-success-100 bg-success-50 px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-success-700">✨ The AI double-checked your resume and found nothing new to add.</p>
                <button type="button" onClick={() => setDismissed(true)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Hide</button>
            </div>
        );
    }

    const apply = () => {
        setForm((f) => {
            const next = { ...f };
            for (const [key, , value] of fields) next[key] = key === 'total_experience' ? String(x.experience_years) : value;
            return next;
        });
        if (newSkills.length) setSkills((cur) => [...cur, ...newSkills.filter((s) => !has(cur, s))]);
        if (newEdu.length) {
            setEducation((cur) => [...cur, ...newEdu.map((e) => ({
                degree: e.degree || '', institution: e.institution || '', field: e.field || '',
                start_year: '', end_year: e.end_year ? String(e.end_year) : '', grade: '',
            }))]);
        }
        setDismissed(true);
        toast.success('Added to your form. Review it and click Save Profile.');
    };

    return (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-gray-900">✨ The AI found more details you can add</p>
                    <p className="text-xs text-gray-500 mt-0.5">It only fills empty fields and adds new items. Nothing is saved until you click Save Profile.</p>
                </div>
                <button type="button" onClick={() => setDismissed(true)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Not now</button>
            </div>

            <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                {fields.map(([key, label, value]) => (
                    <li key={key} className="flex gap-2">
                        <span className="text-gray-400 shrink-0 w-20">{label}</span>
                        <span className="min-w-0 break-words">{value}</span>
                    </li>
                ))}
                {newSkills.length > 0 && (
                    <li className="flex gap-2">
                        <span className="text-gray-400 shrink-0 w-20">Skills</span>
                        <span className="min-w-0">
                            {newSkills.slice(0, 8).join(', ')}{newSkills.length > 8 ? ` and ${newSkills.length - 8} more` : ''}
                        </span>
                    </li>
                )}
                {newEdu.length > 0 && (
                    <li className="flex gap-2">
                        <span className="text-gray-400 shrink-0 w-20">Education</span>
                        <span className="min-w-0">{newEdu.map((e) => [e.degree, e.institution].filter(Boolean).join(', ')).join('; ')}</span>
                    </li>
                )}
            </ul>

            <button
                type="button" onClick={apply}
                className="mt-4 w-full sm:w-auto bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-700 transition"
            >
                Add these to my form
            </button>
        </div>
    );
}
