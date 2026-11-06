import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { recruitmentAPI } from '../../api/recruitment';

const EMPTY = {
    name: '', email: '', phone: '', headline: '', total_experience: '', current_location: '',
    current_salary: '', expected_salary: '', notice_period_days: '', linkedin_url: '', portfolio_url: '', summary: '', skills: '',
};
const FIELD_KEYS = Object.keys(EMPTY).filter((k) => k !== 'skills');

const Field = ({ label, children, wide }) => (
    <div className={wide ? 'sm:col-span-2' : ''}>
        <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
        {children}
    </div>
);
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500';

// Add a candidate (candidateId = null) or edit one. Used by HR ("Candidates") and Admin.
// A resume can be attached; when adding, anything left blank is read from it.
export default function CandidateEditor({ candidateId, onClose, onChanged, defaultJobId = '' }) {
    const isNew = !candidateId;
    const [form, setForm]       = useState(EMPTY);
    const [data, setData]       = useState(null);     // loaded candidate (edit mode)
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving]   = useState(false);
    const [file, setFile]       = useState(null);
    const [jobs, setJobs]       = useState([]);
    const [jobId, setJobId]     = useState(defaultJobId ? String(defaultJobId) : '');
    const fileRef = useRef();

    const apply = (d) => {
        setData(d);
        setForm({ ...EMPTY, ...Object.fromEntries(FIELD_KEYS.map((k) => [k, d[k] ?? ''])) });
    };
    const reload = () => recruitmentAPI.getManagedCandidate(candidateId).then((r) => apply(r.data.data));

    useEffect(() => {
        let alive = true;
        recruitmentAPI.listJobs().then((r) => { if (alive) setJobs((r.data.data || []).filter((j) => j.status === 'active')); }).catch(() => {});
        if (candidateId) {
            recruitmentAPI.getManagedCandidate(candidateId)
                .then((r) => { if (alive) apply(r.data.data); })
                .catch((e) => { toast.error(e.response?.data?.message || 'Could not load the candidate.'); onClose(); })
                .finally(() => { if (alive) setLoading(false); });
        }
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidateId]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async (e) => {
        e.preventDefault();
        if (isNew && !file && (!form.name.trim() || !form.email.trim())) return toast.error('Enter a name and email, or attach a resume to read them from.');
        setSaving(true);
        try {
            if (isNew) {
                const fd = new FormData();
                Object.entries(form).forEach(([k, v]) => { if (String(v).trim() !== '') fd.append(k, v); });
                if (file) fd.append('resume', file);
                if (jobId) fd.append('job_id', jobId);
                const r = await recruitmentAPI.createCandidate(fd);
                toast.success(r.data.message);
                onChanged?.(); onClose();
            } else {
                await recruitmentAPI.updateCandidate(candidateId, form);
                toast.success('Saved');
                onChanged?.();
                await reload();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save.');
        } finally { setSaving(false); }
    };

    const uploadResume = async () => {
        if (!file) return;
        setSaving(true);
        try {
            const r = await recruitmentAPI.uploadCandidateResume(candidateId, file);
            toast.success(r.data.message);
            setFile(null); if (fileRef.current) fileRef.current.value = '';
            onChanged?.(); await reload();
        } catch (err) { toast.error(err.response?.data?.message || 'Upload failed.'); }
        finally { setSaving(false); }
    };

    const openResume = async (id) => {
        try {
            const res = await recruitmentAPI.downloadResume(id);
            window.open(URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' })), '_blank');
        } catch { toast.error('Could not open the resume.'); }
    };

    const assign = async () => {
        if (!jobId) return;
        setSaving(true);
        try {
            const r = await recruitmentAPI.assignCandidateToJob(jobId, candidateId);
            toast.success(r.data.message);
            setJobId(''); onChanged?.(); await reload();
        } catch (err) { toast.error(err.response?.data?.message || 'Could not assign.'); }
        finally { setSaving(false); }
    };

    const removeApp = async (a) => {
        if (!window.confirm(`Take ${data.name} off "${a.title}" at ${a.company_name}?`)) return;
        try {
            await recruitmentAPI.removeCandidateApplication(candidateId, a.application_id);
            toast.success('Removed from the JD'); onChanged?.(); await reload();
        } catch (err) { toast.error(err.response?.data?.message || 'Could not remove.'); }
    };

    const del = async () => {
        if (!window.confirm(`Delete ${data.name}? Their profile, resumes and applications are removed. This cannot be undone.`)) return;
        try {
            await recruitmentAPI.deleteCandidate(candidateId);
            toast.success('Candidate deleted'); onChanged?.(); onClose();
        } catch (err) { toast.error(err.response?.data?.message || 'Could not delete.'); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">{isNew ? 'Add candidate' : `Edit ${data?.name || 'candidate'}`}</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
                </div>

                {loading ? <p className="text-sm text-gray-400 py-10 text-center">Loading…</p> : (
                    <>
                        {isNew && (
                            <p className="text-xs text-gray-500 bg-indigo-50 rounded-xl px-3 py-2 mb-4">
                                Tip: attach a resume first. Name, email, phone, headline and location are read from it, and you only fill in what is missing.
                            </p>
                        )}
                        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label={`Name${isNew && !file ? ' *' : ''}`}><input className={inputCls} value={form.name} onChange={set('name')} /></Field>
                            <Field label={`Email${isNew && !file ? ' *' : ''}`}><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>
                            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
                            <Field label="Current location"><input className={inputCls} value={form.current_location} onChange={set('current_location')} /></Field>
                            <Field label="Headline" wide><input className={inputCls} value={form.headline} onChange={set('headline')} placeholder="e.g. Senior Java Developer" /></Field>
                            <Field label="Experience (years)"><input type="number" min="0" step="0.5" className={inputCls} value={form.total_experience} onChange={set('total_experience')} /></Field>
                            <Field label="Notice period (days)"><input type="number" min="0" className={inputCls} value={form.notice_period_days} onChange={set('notice_period_days')} /></Field>
                            <Field label="Current salary (₹ / year)"><input type="number" min="0" className={inputCls} value={form.current_salary} onChange={set('current_salary')} /></Field>
                            <Field label="Expected salary (₹ / year)"><input type="number" min="0" className={inputCls} value={form.expected_salary} onChange={set('expected_salary')} /></Field>
                            <Field label="LinkedIn"><input className={inputCls} value={form.linkedin_url} onChange={set('linkedin_url')} /></Field>
                            <Field label="Portfolio"><input className={inputCls} value={form.portfolio_url} onChange={set('portfolio_url')} /></Field>
                            <Field label="Summary" wide><textarea rows={3} className={inputCls} value={form.summary} onChange={set('summary')} /></Field>
                            {isNew && <Field label="Extra skills (comma separated)" wide><input className={inputCls} value={form.skills} onChange={set('skills')} placeholder="Java, Spring Boot, SQL" /></Field>}

                            <Field label={isNew ? 'Resume (PDF / DOC / DOCX, up to 5 MB)' : 'Add or replace resume'} wide>
                                <div className="flex gap-2 items-center">
                                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm flex-1" />
                                    {!isNew && <button type="button" disabled={!file || saving} onClick={uploadResume}
                                        className="text-sm px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40">Upload</button>}
                                </div>
                            </Field>

                            {isNew && (
                                <Field label="Put on a JD straight away (needs a resume)" wide>
                                    <select className={inputCls} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                                        <option value="">Not now</option>
                                        {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.company_name}</option>)}
                                    </select>
                                </Field>
                            )}

                            <div className="sm:col-span-2 flex gap-3 mt-1">
                                <button type="submit" disabled={saving} className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                                    {saving ? 'Saving…' : isNew ? 'Add candidate' : 'Save changes'}
                                </button>
                                <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:underline px-3">{isNew ? 'Cancel' : 'Close'}</button>
                            </div>
                        </form>

                        {!isNew && data && (
                            <div className="mt-6 space-y-5 border-t border-gray-100 pt-5">
                                {data.skills?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Skills</p>
                                        <div className="flex flex-wrap gap-1.5">{data.skills.map((s) => <span key={s} className="badge-gray">{s}</span>)}</div>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Resumes</p>
                                    {data.resumes.length === 0 ? <p className="text-sm text-gray-400">No resume on file.</p> : (
                                        <ul className="text-sm space-y-1">
                                            {data.resumes.map((r) => (
                                                <li key={r.id} className="flex items-center justify-between">
                                                    <span className="truncate">{r.file_name} {r.is_primary ? <span className="badge-green ml-1">current</span> : null}</span>
                                                    <button onClick={() => openResume(r.id)} className="text-xs text-indigo-600 hover:underline shrink-0 ml-3">View</button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Job applications</p>
                                    {data.applications.length === 0 ? <p className="text-sm text-gray-400 mb-2">Not on any JD yet.</p> : (
                                        <ul className="text-sm space-y-1.5 mb-3">
                                            {data.applications.map((a) => (
                                                <li key={a.application_id} className="flex items-center justify-between gap-3">
                                                    <span className="min-w-0">
                                                        <span className="font-medium text-gray-800">{a.title}</span>
                                                        <span className="text-gray-500"> · {a.company_name} · {a.status}{a.fit_score != null ? ` · ${a.fit_score}% fit` : ''}</span>
                                                    </span>
                                                    <button onClick={() => removeApp(a)} className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="flex gap-2">
                                        <select className={inputCls} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                                            <option value="">Assign to a JD…</option>
                                            {jobs.filter((j) => !data.applications.some((a) => a.job_id === j.id)).map((j) => <option key={j.id} value={j.id}>{j.title} · {j.company_name}</option>)}
                                        </select>
                                        <button disabled={!jobId || saving} onClick={assign} className="text-sm px-4 rounded-xl bg-indigo-600 text-white disabled:opacity-40 shrink-0">Assign</button>
                                    </div>
                                </div>
                                <div className="border-t border-gray-100 pt-4">
                                    {data.delete_blocked_reason
                                        ? <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">{data.delete_blocked_reason}</p>
                                        : <button onClick={del} className="text-sm text-red-600 border border-red-200 rounded-xl px-4 py-1.5 hover:bg-red-50">Delete candidate…</button>}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
