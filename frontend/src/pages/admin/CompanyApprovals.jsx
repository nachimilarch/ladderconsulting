import { useEffect, useState } from 'react';
import { adminCompanyAPI, adminStaffAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const STATUS_TABS = ['pending', 'approved', 'suspended', 'all'];

const statusBadge = (s, neverLoggedIn = false) => {
    // Approved companies that have never logged in get a distinct colour + label
    // so admins can tell they're onboarded but haven't signed in yet.
    if (s === 'approved' && neverLoggedIn) {
        return (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                Approved · Not logged in
            </span>
        );
    }
    const map = {
        pending:   'bg-yellow-100 text-yellow-700',
        approved:  'bg-green-100 text-green-700',
        suspended: 'bg-red-100 text-red-700',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${map[s] || 'bg-gray-100 text-gray-600'}`}>
            {s}
        </span>
    );
};

export default function CompanyApprovals() {
    const [tab, setTab] = useState('pending');
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState(null);
    const [modal, setModal] = useState(null); // { type, company }
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const [staffList, setStaffList] = useState([]);
    const [selectedExec, setSelectedExec] = useState('');
    const [assigningExec, setAssigningExec] = useState(false);

    const [feePercent, setFeePercent] = useState('');
    const [agreementFile, setAgreementFile] = useState(null);
    const [savingFeeRate, setSavingFeeRate] = useState(false);
    const [downloadingAgreement, setDownloadingAgreement] = useState(false);

    const load = () => {
        setLoading(true);
        const params = tab !== 'all' ? { status: tab } : {};
        adminCompanyAPI.list(params)
            .then((r) => {
                const list = Array.isArray(r.data) ? r.data : r.data?.companies ?? r.data?.data ?? [];
                setCompanies(list);
            })
            .catch(() => { toast.error('Failed to load companies'); setCompanies([]); })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [tab]); // eslint-disable-line

    useEffect(() => {
        adminStaffAPI.list()
            .then(r => setStaffList(r.data?.staff || r.data?.data || []))
            .catch(() => {});
    }, []);

    const openDetail = async (id) => {
        try {
            const r = await adminCompanyAPI.getDetail(id);
            const payload = r.data?.data;
            const company = payload?.company || payload || r.data;
            setDetail(company);
            setSelectedExec(company?.assigned_executive_id || '');
            setFeePercent(company?.placement_fee_percent ?? '');
            setAgreementFile(null);
        } catch {
            toast.error('Failed to load company details');
        }
    };

    const handleSaveFeeRate = async (clear = false) => {
        if (!detail) return;
        setSavingFeeRate(true);
        try {
            const formData = new FormData();
            formData.append('placement_fee_percent', clear ? '' : feePercent);
            if (agreementFile) formData.append('agreement', agreementFile);
            const r = await adminCompanyAPI.setPlacementFeeRate(detail.id, formData);
            toast.success(r.data?.message || 'Placement fee rate updated.');
            openDetail(detail.id);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update placement fee rate.');
        } finally {
            setSavingFeeRate(false);
        }
    };

    const handleDownloadAgreement = async () => {
        if (!detail) return;
        setDownloadingAgreement(true);
        try {
            const res = await adminCompanyAPI.downloadAgreement(detail.id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${(detail.company_name || 'agreement').replace(/\s+/g, '_')}_agreement`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to download agreement.');
        } finally {
            setDownloadingAgreement(false);
        }
    };

    const handleActivatePackage = async (tier) => {
        if (!detail) return;
        const label = tier === 'single' ? 'Single (₹999)' : '5-Pack (₹3,999)';
        if (!window.confirm(`Activate ${label} for ${detail.company_name}? This creates a paid invoice without Cashfree.`)) return;
        try {
            const { data } = await adminCompanyAPI.activatePackage(detail.id, tier);
            toast.success(data?.message || 'Package activated.');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to activate package.');
        }
    };

    const handleAssignExec = async () => {
        if (!selectedExec || !detail) return;
        setAssigningExec(true);
        try {
            await adminCompanyAPI.assignExecutive(detail.id, { executive_id: Number(selectedExec) });
            toast.success('Executive assigned');
            openDetail(detail.id);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to assign executive');
        } finally {
            setAssigningExec(false);
        }
    };

    const closeModal = () => { setModal(null); setReason(''); };

    const handleAction = async () => {
        if (!modal) return;
        setSaving(true);
        try {
            const { type, company } = modal;
            if (type === 'approve')    await adminCompanyAPI.approve(company.id);
            if (type === 'reject')     await adminCompanyAPI.reject(company.id, { reason });
            if (type === 'suspend')    await adminCompanyAPI.suspend(company.id, { reason });
            if (type === 'reactivate') await adminCompanyAPI.reactivate(company.id);
            if (type === 'delete')     await adminCompanyAPI.remove(company.id);
            toast.success(`Company ${type}d`);
            closeModal();
            setDetail(null);
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Action failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Company Approvals</h2>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
                {STATUS_TABS.map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                            tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="flex gap-6">
                {/* List */}
                <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden">
                    {loading ? (
                        <p className="p-6 text-gray-400 text-sm">Loading…</p>
                    ) : companies.length === 0 ? (
                        <p className="p-6 text-gray-400 text-sm">No {tab} companies.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    {['Company', 'Email / Phone', 'Industry', 'Joined', 'Status', ''].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(Array.isArray(companies) ? companies : []).map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">{c.company_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">
                                            <div>{c.email}</div>
                                            {c.contact_phone && <div className="text-xs text-indigo-600 font-medium">📞 {c.contact_phone}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{c.industry || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">{statusBadge(c.company_status, c.never_logged_in)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => openDetail(c.id)}
                                                className="text-indigo-600 hover:underline text-xs"
                                            >
                                                View →
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Detail panel */}
                {detail && (
                    <div className="w-80 bg-white rounded-lg shadow-sm p-5 shrink-0">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-800">{detail.company_name || 'No name'}</h3>
                                <p className="text-xs text-gray-500">{detail.email}</p>
                            </div>
                            <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <dl className="space-y-2 text-sm mb-4">
                            {[
                                ['Contact', detail.contact_name],
                                ['Phone', detail.contact_phone],
                                ['Industry', detail.industry],
                                ['Size', detail.company_size || detail.size],
                                ['Location', detail.location || detail.headquarters],
                                ['Website', detail.website],
                                ['Status', statusBadge(detail.company_status, detail.never_logged_in)],
                                ['Job Postings', detail.job_count],
                                ['Applications', detail.application_count],
                            ].map(([k, v]) => v != null && (
                                <div key={k} className="flex justify-between gap-3">
                                    <dt className="text-gray-500 shrink-0">{k}</dt>
                                    <dd className="font-medium text-gray-700 text-right truncate max-w-[190px]">{v}</dd>
                                </div>
                            ))}
                        </dl>

                        {detail.description && (
                            <p className="text-xs text-gray-500 mb-4 border-t pt-3">{detail.description}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {detail.company_status === 'pending' && (
                                <>
                                    <button onClick={() => setModal({ type: 'approve', company: detail })}
                                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                        Approve
                                    </button>
                                    <button onClick={() => setModal({ type: 'reject', company: detail })}
                                        className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                                        Reject
                                    </button>
                                </>
                            )}
                            {detail.company_status === 'approved' && (
                                <button onClick={() => setModal({ type: 'suspend', company: detail })}
                                    className="px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">
                                    Suspend
                                </button>
                            )}
                            {detail.company_status === 'suspended' && (
                                <button onClick={() => setModal({ type: 'reactivate', company: detail })}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                    Reactivate
                                </button>
                            )}
                            <button onClick={() => setModal({ type: 'delete', company: detail })}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
                                Delete
                            </button>
                        </div>

                        {/* Executive Assignment */}
                        <div className="border-t mt-4 pt-4">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Account Executive</p>
                            {detail.assigned_executive_id && (
                                <p className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded mb-2">
                                    Currently: {staffList.find(s => s.id === detail.assigned_executive_id)?.name || `ID ${detail.assigned_executive_id}`}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <select
                                    value={selectedExec}
                                    onChange={e => setSelectedExec(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="">Select executive…</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleAssignExec}
                                    disabled={!selectedExec || assigningExec}
                                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    {assigningExec ? '…' : 'Assign'}
                                </button>
                            </div>
                        </div>

                        {/* Package Activation (Single / 5-Pack — offline payment) */}
                        <div className="border-t mt-4 pt-4">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Activate Package (Offline Payment)</p>
                            <p className="text-xs text-gray-400 mb-2">Creates a paid invoice + credits without Cashfree. Use when payment was collected offline.</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleActivatePackage('single')}
                                    className="px-2 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs rounded hover:bg-indigo-50 transition"
                                >
                                    Activate Single (₹999)
                                </button>
                                <button
                                    onClick={() => handleActivatePackage('pack_4')}
                                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition"
                                >
                                    Activate 5-Pack (₹3,999)
                                </button>
                            </div>
                        </div>

                        {/* Placement Fee Rate / Platinum */}
                        <div className="border-t mt-4 pt-4">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Placement Fee Rate (Platinum)</p>
                            {detail.placement_fee_percent != null ? (
                                <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded mb-2">
                                    ⭐ Platinum — {parseFloat(detail.placement_fee_percent)}% contracted rate, free resume unlocks
                                </p>
                            ) : (
                                <p className="text-xs text-gray-400 mb-2">Using platform default rate — no contracted % set.</p>
                            )}
                            {detail.agreement_file_key && (
                                <button
                                    onClick={handleDownloadAgreement}
                                    disabled={downloadingAgreement}
                                    className="text-xs text-indigo-600 hover:underline block mb-2 disabled:opacity-50"
                                >
                                    {downloadingAgreement ? 'Downloading…' : '📄 Download uploaded agreement'}
                                </button>
                            )}
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="number" step="0.01" min="0" max="100"
                                    value={feePercent}
                                    onChange={e => setFeePercent(e.target.value)}
                                    placeholder="e.g. 8.33"
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={() => handleSaveFeeRate(false)}
                                    disabled={!feePercent || savingFeeRate}
                                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    {savingFeeRate ? '…' : 'Save'}
                                </button>
                                {detail.placement_fee_percent != null && (
                                    <button
                                        onClick={() => handleSaveFeeRate(true)}
                                        disabled={savingFeeRate}
                                        className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 disabled:opacity-40"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <input
                                type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={e => setAgreementFile(e.target.files?.[0] || null)}
                                className="text-xs w-full"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Optional — attach the signed onboarding agreement for reference.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Action modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <h3 className="font-semibold text-gray-800 mb-2 capitalize">
                            {modal.type} Company
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {modal.company.company_name || modal.company.email}
                        </p>

                        {['reject', 'suspend'].includes(modal.type) && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Reason {modal.type === 'reject' ? '(required)' : '(optional)'}
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter reason…"
                                />
                            </div>
                        )}

                        {modal.type === 'delete' && (
                            <p className="text-sm text-red-600 mb-4">
                                This permanently deletes the company and all associated data. This cannot be undone.
                            </p>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                                Cancel
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={saving || (modal.type === 'reject' && !reason.trim())}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
