import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportAPI } from '../../api/hr';

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const toISODate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';

const STAGE_LABELS = {
    applied: 'Applied', under_review: 'Under Review', shortlisted: 'Shortlisted',
    interview_scheduled: 'Interview', interviewed: 'Interviewed', offer_sent: 'Offer Sent',
    hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn',
};
const STAGE_ORDER = ['applied', 'under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offer_sent', 'hired', 'rejected', 'withdrawn'];
const STAGE_COLORS = {
    applied: 'bg-gray-100 text-gray-700', under_review: 'bg-blue-50 text-blue-700',
    shortlisted: 'bg-indigo-50 text-indigo-700', interview_scheduled: 'bg-violet-50 text-violet-700',
    interviewed: 'bg-purple-50 text-purple-700', offer_sent: 'bg-amber-50 text-amber-700',
    hired: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-600',
    withdrawn: 'bg-gray-50 text-gray-500',
};

function Kpi({ label, value, sub, tone = 'blue' }) {
    const tones = {
        blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
        amber: 'bg-amber-50 text-amber-700', violet: 'bg-violet-50 text-violet-700',
        red: 'bg-red-50 text-red-600', gray: 'bg-gray-50 text-gray-700',
    };
    return (
        <div className="card-p">
            <div className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full mb-2 ${tones[tone]}`}>{label}</div>
            <div className="text-3xl font-bold text-gray-900 leading-none">{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
}

// Get first/last day of current month as YYYY-MM-DD
const thisMonthStart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const today = () => new Date().toISOString().slice(0, 10);

export default function Reports() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const printRef = useRef(null);

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = (from, to) => {
        setLoading(true);
        const params = {};
        if (from) params.date_from = from;
        if (to) params.date_to = to;
        reportAPI.hiring(params)
            .then(r => setData(r.data?.data || null))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(dateFrom, dateTo); }, [dateFrom, dateTo]);

    const downloadCSV = () => {
        if (!data) return;
        const k = data.kpis;
        const rows = [
            ['Report: Hiring Performance KPIs'],
            ['Period', dateFrom || 'All time', dateTo || 'All time'],
            [],
            ['Metric', 'Value'],
            ['Total Hires', k.hires_total],
            ['Hires This Month', k.hires_this_month],
            ['Active Jobs', k.active_jobs],
            ['Total Applications', k.total_applications],
            ['Candidates Sourced', k.candidates_sourced],
            ['Placement Fees Collected', k.placement_fees_collected],
            ['Pending Interview Requests', k.pending_interview_requests],
            ['Pending Offer Requests', k.pending_offer_requests],
            ['Upcoming Interviews', k.upcoming_interviews],
            ['Outstanding Invoices', k.pending_invoices],
            ['Outstanding Amount', k.outstanding_amount],
            [],
            ['Pipeline by Stage'],
            ['Stage', 'Count'],
            ...STAGE_ORDER.filter(s => data.pipeline?.find(p => p.status === s)).map(s => {
                const row = data.pipeline.find(p => p.status === s);
                return [STAGE_LABELS[s] || s, row?.count || 0];
            }),
            [],
            ['Recent Offer Letters Sent'],
            ['Candidate', 'Role', 'Company', 'CTC', 'Offer Date'],
            ...(data.recent_placements || []).map(p => [
                p.candidate_name, p.role_title || '', p.company_name,
                p.ctc || '', p.joining_date ? toISODate(p.joining_date) : '',
            ]),
        ];
        const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hiring-report-${today()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => window.print();

    if (loading) return <div className="max-w-6xl mx-auto p-6 text-sm text-gray-400">Loading hiring report…</div>;
    if (!data) return <div className="max-w-6xl mx-auto p-6 text-sm text-gray-500">Could not load the hiring report.</div>;

    const k = data.kpis;
    const pipelineMap = Object.fromEntries((data.pipeline || []).map(p => [p.status, p.count]));
    const totalPipeline = (data.pipeline || []).reduce((s, p) => s + Number(p.count), 0);

    return (
        <div ref={printRef} className="max-w-6xl mx-auto p-6 print:p-0">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap print:mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hiring Performance Report</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {isAdmin
                            ? 'All companies.'
                            : `${data.scope.companies} assigned ${data.scope.companies === 1 ? 'company' : 'companies'}.`}
                        {(dateFrom || dateTo) && (
                            <span className="ml-2 text-indigo-600 font-medium">
                                {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `From ${dateFrom}` : `Until ${dateTo}`}
                            </span>
                        )}
                    </p>
                </div>

                {/* Date filters + download (hidden in print) */}
                <div className="flex flex-wrap gap-3 items-center print:hidden">
                    <div className="flex items-center gap-2 text-sm">
                        <label className="text-gray-500 shrink-0">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <label className="text-gray-500 shrink-0">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    {(dateFrom || dateTo) && (
                        <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                            className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
                    )}
                    <button onClick={() => { setDateFrom(thisMonthStart()); setDateTo(today()); }}
                        className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-gray-50">
                        This Month
                    </button>
                    <div className="flex gap-2">
                        <button onClick={downloadCSV}
                            className="flex items-center gap-1.5 text-xs border border-indigo-200 text-indigo-700 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition">
                            <span>↓</span> CSV
                        </button>
                        <button onClick={handlePrint}
                            className="flex items-center gap-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
                            <span>🖨</span> Print / PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                <Kpi label="Hires" value={k.hires_total} sub={`${k.hires_this_month} this month`} tone="green" />
                <Kpi label="Active Jobs" value={k.active_jobs} tone="blue" />
                <Kpi label="Applications" value={k.total_applications} sub={`${k.candidates_sourced} sourced`} tone="violet" />
                <Kpi label="Placement Fees" value={fmtINR(k.placement_fees_collected)} sub="collected" tone="green" />
                <Kpi label="Pending Interview Requests" value={k.pending_interview_requests} tone="amber" />
                <Kpi label="Pending Offer Requests" value={k.pending_offer_requests} tone="amber" />
                <Kpi label="Upcoming Interviews" value={k.upcoming_interviews} sub={`${k.awaiting_candidate_confirmation} awaiting confirmation`} tone="blue" />
                <Kpi label="Outstanding Invoices" value={k.pending_invoices} sub={fmtINR(k.outstanding_amount)} tone="red" />
            </div>

            {/* Pending actions */}
            <h2 className="section-title">Pending actions</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                <div className="card-p">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800 text-sm">Interview requests to approve</h3>
                        <Link to="/hr/interviews" className="text-xs text-blue-600 hover:underline print:hidden">Open →</Link>
                    </div>
                    {data.pending_actions.interview_requests.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3">Nothing pending.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {data.pending_actions.interview_requests.map(r => (
                                <li key={r.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                                    <span className="min-w-0">
                                        <span className="font-medium text-gray-800">{r.candidate_name}</span>
                                        <span className="text-gray-400"> · {r.job_title} · {r.company_name}</span>
                                    </span>
                                    <Link to={`/hr/interview-requests/${r.id}`} className="text-xs text-blue-600 hover:underline shrink-0 ml-2 print:hidden">Review</Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="card-p">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800 text-sm">Offer letter requests to approve</h3>
                        <Link to="/hr/offer-requests" className="text-xs text-blue-600 hover:underline print:hidden">Open →</Link>
                    </div>
                    {data.pending_actions.offer_requests.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3">Nothing pending.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {data.pending_actions.offer_requests.map(r => (
                                <li key={r.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                                    <span className="min-w-0">
                                        <span className="font-medium text-gray-800">{r.candidate_name}</span>
                                        <span className="text-gray-400"> · {r.job_title} · {r.company_name}</span>
                                        {r.placement_fee_amount != null && (
                                            <span className="text-gray-500"> · {fmtINR(r.placement_fee_amount)}</span>
                                        )}
                                    </span>
                                    <Link to="/hr/offer-requests" className="text-xs text-blue-600 hover:underline shrink-0 ml-2 print:hidden">Review</Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Pipeline */}
            <h2 className="section-title">Candidate pipeline</h2>
            <div className="card-p mb-8">
                {totalPipeline === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No applications in this period.</p>
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {STAGE_ORDER.filter(s => pipelineMap[s]).map(s => (
                            <div key={s} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${STAGE_COLORS[s] || 'bg-gray-50 text-gray-700'}`}>
                                <span className="text-lg font-bold">{pipelineMap[s]}</span>
                                <span className="text-xs">{STAGE_LABELS[s] || s}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent offers */}
            <h2 className="section-title">Recent offer letters sent</h2>
            <div className="table-wrapper">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Candidate</th><th>Role</th><th>Company</th><th>CTC</th><th>Offer Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.recent_placements.length === 0 ? (
                            <tr><td colSpan={5} className="table-empty">No offer letters sent in this period.</td></tr>
                        ) : data.recent_placements.map(p => (
                            <tr key={p.id}>
                                <td className="font-medium text-gray-800">{p.candidate_name}</td>
                                <td>{p.role_title || '—'}</td>
                                <td className="text-gray-500">{p.company_name}</td>
                                <td>{p.ctc ? fmtINR(p.ctc) : '—'}</td>
                                <td className="text-gray-500">{fmtDate(p.joining_date)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
