import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { outreachAiAPI } from '../../../api/outreachAi';

export function Spinner({ className = 'w-4 h-4' }) {
    return <span className={`inline-block ${className} rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin`} aria-hidden="true" />;
}

// Shown while the model works. The seconds counter tells people it has not frozen.
export function AiRunning({ startedAt, what = 'writing' }) {
    const [secs, setSecs] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setSecs(Math.round((Date.now() - startedAt) / 1000)), 1000);
        return () => clearInterval(t);
    }, [startedAt]);
    return (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 flex items-start gap-3">
            <Spinner className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
                <p className="text-sm font-semibold text-gray-800">The AI is {what}… {secs}s</p>
                <p className="text-xs text-gray-500 mt-0.5">This usually takes under a minute, and on a busy server a few minutes. You can move around the portal; the result is saved for you.</p>
            </div>
        </div>
    );
}

export function AiError({ message, onRetry }) {
    return (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-danger-700">{message}</p>
            {onRetry && <button type="button" onClick={onRetry} className="text-xs font-semibold text-danger-700 underline shrink-0">Try again</button>}
        </div>
    );
}

export function CopyButton({ text, label = 'Copy', className = '' }) {
    return (
        <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success('Copied')).catch(() => toast.error('Could not copy'))}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition ${className}`}
        >
            {label}
        </button>
    );
}

// Email HTML shown in a sandboxed frame: scripts and links cannot run, whatever the text says.
export function HtmlPreview({ html, height = 'h-56' }) {
    const doc = `<!doctype html><meta charset="utf-8"><style>body{font:14px/1.55 system-ui,sans-serif;color:#1f2937;margin:0;padding:14px}p{margin:0 0 10px}</style>${html || ''}`;
    return <iframe title="Email preview" sandbox="" srcDoc={doc} className={`w-full ${height} rounded-xl border border-gray-200 bg-white`} />;
}

export function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="text-xs font-semibold text-gray-600">{label}</span>
            <div className="mt-1">{children}</div>
            {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
        </label>
    );
}

export function PrimaryButton({ children, ...props }) {
    return (
        <button
            type="button"
            {...props}
            className={`inline-flex items-center justify-center gap-2 bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition ${props.className || ''}`}
        >
            {children}
        </button>
    );
}

export function GhostButton({ children, ...props }) {
    return (
        <button
            type="button"
            {...props}
            className={`inline-flex items-center justify-center gap-1.5 border border-gray-200 bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition ${props.className || ''}`}
        >
            {children}
        </button>
    );
}

const TONE = {
    green: 'bg-success-50 text-success-700 ring-success-600/20',
    amber: 'bg-warning-50 text-warning-800 ring-warning-600/25',
    red: 'bg-danger-50 text-danger-700 ring-danger-600/20',
    gray: 'bg-gray-100 text-gray-600 ring-gray-500/15',
    brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};
export function Pill({ tone = 'gray', children }) {
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${TONE[tone] || TONE.gray}`}>{children}</span>;
}

// Copy-quality result from /check-copy, shown as a score and the fixes worth making.
export function CopyReport({ report }) {
    if (!report) return null;
    const tone = report.level === 'good' ? 'green' : report.level === 'ok' ? 'amber' : 'red';
    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3">
            <div className="flex items-center gap-2 flex-wrap">
                <Pill tone={tone}>Copy check: {report.score}/100</Pill>
                <span className="text-[11px] text-gray-400">{report.stats.words} words, about {Math.max(1, Math.round(report.stats.reading_seconds / 60 * 10) / 10)} min to read</span>
            </div>
            {report.issues.length === 0 ? (
                <p className="text-xs text-success-700 mt-2">No problems found.</p>
            ) : (
                <ul className="mt-2 space-y-1.5">
                    {report.issues.map((i) => (
                        <li key={i.code} className="text-xs text-gray-700 flex gap-2">
                            <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${i.severity === 'high' ? 'bg-danger-500' : i.severity === 'medium' ? 'bg-warning-500' : 'bg-gray-300'}`} />
                            <span><span className="font-medium">{i.message}.</span> <span className="text-gray-500">{i.fix}</span></span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// The last few finished results for a task type, so a good draft is never lost on refresh.
export function RecentResults({ kind, onPick, refreshKey, describe }) {
    const [items, setItems] = useState([]);
    useEffect(() => {
        let cancelled = false;
        outreachAiAPI.recent(kind, 6).then(({ data }) => { if (!cancelled) setItems(data.data || []); }).catch(() => {});
        return () => { cancelled = true; };
    }, [kind, refreshKey]);
    if (!items.length) return null;
    return (
        <details className="mt-4 group">
            <summary className="text-xs font-semibold text-gray-500 cursor-pointer select-none">Recent results ({items.length})</summary>
            <ul className="mt-2 space-y-1.5">
                {items.map((it) => (
                    <li key={it.id}>
                        <button type="button" onClick={() => onPick(it)} className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition">
                            <span className="font-medium text-gray-700">{describe(it)}</span>
                            <span className="text-gray-400"> · {new Date(it.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </details>
    );
}
