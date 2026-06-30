import { useEffect, useState } from 'react';
import { adminRecruitmentAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const Stat = ({ label, value }) => (
    <div className="bg-white rounded-lg p-4 shadow-sm text-center">
        <p className="text-2xl font-bold text-gray-800">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
);

const stageBadge = (stage) => {
    const map = {
        applied:      'bg-gray-100 text-gray-600',
        shortlisted:  'bg-blue-100 text-blue-700',
        interviewed:  'bg-purple-100 text-purple-700',
        offer_sent:   'bg-yellow-100 text-yellow-700',
        hired:        'bg-green-100 text-green-700',
        rejected:     'bg-red-100 text-red-700',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${map[stage] || 'bg-gray-100 text-gray-600'}`}>
            {stage?.replace(/_/g, ' ')}
        </span>
    );
};

const TABS = ['Pipeline', 'Placements'];

export default function RecruitmentOversight() {
    const [overview, setOverview] = useState(null);
    const [pipeline, setPipeline] = useState([]);
    const [placements, setPlacements] = useState([]);
    const [tab, setTab] = useState('Pipeline');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            adminRecruitmentAPI.getOverview(),
            adminRecruitmentAPI.getPipeline(),
            adminRecruitmentAPI.getPlacements(),
        ])
            .then(([o, p, pl]) => {
                setOverview(o.data?.overview ?? o.data);
                setPipeline(Array.isArray(p.data) ? p.data : p.data?.pipeline ?? p.data?.data ?? []);
                setPlacements(Array.isArray(pl.data) ? pl.data : pl.data?.placements ?? pl.data?.data ?? []);
            })
            .catch(() => { toast.error('Failed to load recruitment data'); setPipeline([]); setPlacements([]); })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>;

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Recruitment Oversight</h2>

            {/* Stats bar */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                {[
                    { label: 'Active Jobs',    value: overview?.active_jobs },
                    { label: 'Applications',   value: overview?.total_applications },
                    { label: 'Shortlisted',    value: overview?.shortlisted },
                    { label: 'Interviewed',    value: overview?.interviewed },
                    { label: 'Offers Sent',    value: overview?.offers_sent },
                    { label: 'Hired',          value: overview?.hired },
                ].map((s) => <Stat key={s.label} {...s} />)}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
                {TABS.map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'Pipeline' && (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {(Array.isArray(pipeline) ? pipeline : []).length === 0 ? (
                        <p className="p-6 text-gray-400 text-sm">No pipeline data.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    {['Candidate', 'Job Title', 'Company', 'Applied', 'Stage'].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(Array.isArray(pipeline) ? pipeline : []).map((row) => (
                                    <tr key={row.application_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">{row.candidate_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600">{row.job_title}</td>
                                        <td className="px-4 py-3 text-gray-500">{row.company_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-400">{new Date(row.applied_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">{stageBadge(row.pipeline_stage)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'Placements' && (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {(Array.isArray(placements) ? placements : []).length === 0 ? (
                        <p className="p-6 text-gray-400 text-sm">No placements yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    {['Candidate', 'Job Title', 'Company', 'CTC', 'Joining Date', 'Accepted'].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(Array.isArray(placements) ? placements : []).map((p) => (
                                    <tr key={p.offer_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">{p.candidate_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.job_title}</td>
                                        <td className="px-4 py-3 text-gray-500">{p.company_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-700 font-medium">
                                            {p.ctc_amount ? `${p.currency || ''} ${Number(p.ctc_amount).toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {p.joining_date ? new Date(p.joining_date).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">
                                            {new Date(p.accepted_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
