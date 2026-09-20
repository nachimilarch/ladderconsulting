import { useCallback, useEffect, useRef, useState } from 'react';
import { outreachAiAPI } from '../../../api/outreachAi';

const POLL_MS = 4000;
const GIVE_UP_MS = 10 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Starts one AI writing task and polls until it finishes. The task lives on the server, so a
// slow model never blocks the page. phase: idle | running | done | failed.
export default function useAiTask() {
    const [state, setState] = useState({ phase: 'idle', result: null, error: '', startedAt: 0 });
    const alive = useRef(true);
    const runId = useRef(0);

    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const run = useCallback(async (kind, input) => {
        const mine = ++runId.current;
        const active = () => alive.current && runId.current === mine;
        const startedAt = Date.now();
        setState({ phase: 'running', result: null, error: '', startedAt });
        const fail = (error) => { if (active()) setState({ phase: 'failed', result: null, error, startedAt }); };
        let id;
        try {
            const { data } = await outreachAiAPI.startTask(kind, input);
            id = data.data.id;
        } catch (err) {
            return fail(err.response?.data?.message || 'Could not start the AI task.');
        }
        while (active()) {
            await sleep(POLL_MS);
            if (!active()) return undefined;
            try {
                const { data } = await outreachAiAPI.getTask(id);
                const t = data.data;
                if (t.status === 'done') { if (active()) setState({ phase: 'done', result: t.result, error: '', startedAt }); return undefined; }
                if (t.status === 'failed') return fail(t.error || 'The AI did not finish. Please try again.');
            } catch {
                return fail('Lost contact with the server. Try again.');
            }
            if (Date.now() - startedAt > GIVE_UP_MS) return fail('This is taking too long. Try again in a few minutes.');
        }
        return undefined;
    }, []);

    const load = useCallback((result) => { runId.current += 1; setState({ phase: 'done', result, error: '', startedAt: 0 }); }, []);
    const reset = useCallback(() => { runId.current += 1; setState({ phase: 'idle', result: null, error: '', startedAt: 0 }); }, []);

    return { ...state, run, load, reset, running: state.phase === 'running' };
}
