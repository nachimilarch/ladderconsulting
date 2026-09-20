import { useEffect, useRef, useState } from 'react';
import { matchInsightAPI } from '../../api/matchInsight';

const POLL_MS = 5000;
const GIVE_UP_MS = 4 * 60 * 1000;

// "Why this fit?" for one candidate against one job. The score itself comes from the fixed
// formula; this asks the AI model to explain it in a couple of sentences. It is shown only on
// the top few candidates, is cached after the first ask, and can take up to a minute.
export default function MatchInsight({ jobId, candidateId }) {
    // idle | loading | ready | failed | busy | hidden
    const [state, setState] = useState({ status: 'idle', note: '' });
    const timer = useRef(null);
    const startedAt = useRef(0);

    const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

    const poll = () => {
        matchInsightAPI.get(jobId, candidateId)
            .then(({ data }) => {
                const d = data.data;
                if (d.status === 'ready') return setState({ status: 'ready', note: d.note });
                if (d.status === 'failed') return setState({ status: 'failed', note: '' });
                if (Date.now() - startedAt.current > GIVE_UP_MS) return setState({ status: 'failed', note: '' });
                timer.current = setTimeout(poll, POLL_MS);
            })
            .catch(() => setState({ status: 'failed', note: '' }));
    };

    // A note that already exists shows straight away; otherwise the button waits to be pressed.
    useEffect(() => {
        let cancelled = false;
        matchInsightAPI.get(jobId, candidateId)
            .then(({ data }) => {
                if (cancelled) return;
                const d = data.data;
                if (d.status === 'ready') setState({ status: 'ready', note: d.note });
                else if (d.status === 'pending') {
                    startedAt.current = Date.now();
                    setState({ status: 'loading', note: '' });
                    timer.current = setTimeout(poll, POLL_MS);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; stop(); };
    }, [jobId, candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

    const ask = async () => {
        setState({ status: 'loading', note: '' });
        startedAt.current = Date.now();
        try {
            const { data } = await matchInsightAPI.request(jobId, candidateId);
            const d = data.data;
            if (d.status === 'ready') return setState({ status: 'ready', note: d.note });
            if (d.status === 'disabled') return setState({ status: 'hidden', note: '' });
            if (d.status === 'busy') return setState({ status: 'busy', note: '' });
            timer.current = setTimeout(poll, POLL_MS);
        } catch (err) {
            setState({ status: err.response?.status === 429 ? 'limit' : 'failed', note: '' });
        }
    };

    if (state.status === 'hidden') return null;

    if (state.status === 'ready') {
        return (
            <div className="mt-3 rounded-xl bg-brand-50 border border-brand-100 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 mb-0.5">✨ Why this fit</p>
                <p className="text-sm text-gray-700 leading-snug">{state.note}</p>
                <p className="text-[10px] text-gray-400 mt-1">Written by AI from the skills and experience above. The match % comes from a fixed formula.</p>
            </div>
        );
    }

    if (state.status === 'loading') {
        return (
            <p className="mt-3 text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-brand-300 border-t-brand-600 animate-spin" aria-hidden="true" />
                The AI is reading this match. It can take up to a minute; you can keep working.
            </p>
        );
    }

    const message = {
        failed: "The AI couldn't write this note. Try again in a moment.",
        busy: 'The AI is busy with other requests. Try again shortly.',
        limit: "You've reached today's limit for AI notes. Try again tomorrow.",
    }[state.status];

    return (
        <div className="mt-3">
            <button
                type="button"
                onClick={ask}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-brand-200 text-brand-700 bg-white hover:bg-brand-50 transition"
            >
                ✨ Why this fit?
            </button>
            {message && <span className="ml-2 text-xs text-gray-500">{message}</span>}
        </div>
    );
}
