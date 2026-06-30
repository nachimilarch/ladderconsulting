import { useEffect, useRef, useState } from 'react';
import { profileAPI, resumeAPI } from '../../api/candidate';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
    full_name: '', phone: '', headline: '', location: '',
    total_experience: '', linkedin_url: '', portfolio_url: '', summary: '',
};

const EMPTY_EDU = { degree: '', institution: '', field: '', start_year: '', end_year: '', grade: '' };

export default function CandidateProfile() {
    const [loading, setLoading]       = useState(true);
    const [saving, setSaving]         = useState(false);
    const [uploading, setUploading]   = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extracted, setExtracted]   = useState(false); // show green banner

    const [form, setForm]           = useState(EMPTY_FORM);
    const [education, setEducation] = useState([]);
    const [skills, setSkills]       = useState([]); // string[]
    const [skillInput, setSkillInput] = useState('');
    const [resume, setResume]       = useState(null);

    const fileRef = useRef();

    // ── Load existing profile ──────────────────────────────────────────────────
    useEffect(() => {
        profileAPI.get()
            .then(({ data }) => {
                const p = data.profile;
                if (p) {
                    setForm({
                        full_name:        p.full_name        || '',
                        phone:            p.phone            || '',
                        headline:         p.headline         || '',
                        location:         p.location         || p.current_location || '',
                        total_experience: p.total_experience != null ? String(p.total_experience) : '',
                        linkedin_url:     p.linkedin_url     || '',
                        portfolio_url:    p.portfolio_url    || '',
                        summary:          p.summary          || '',
                    });
                }
                setEducation(Array.isArray(data.education) ? data.education : []);
                setSkills(
                    Array.isArray(data.skills)
                        ? data.skills.map(s => s.skill_name || s.name || s).filter(Boolean)
                        : []
                );
                setResume(data.resume || null);
            })
            .catch(() => toast.error('Failed to load profile'))
            .finally(() => setLoading(false));
    }, []);

    // ── Upload resume → then extract profile automatically ────────────────────
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('resume', file);
            const { data } = await resumeAPI.upload(fd);
            setResume({
                original_name: data.data?.original_name || file.name,
                created_at: new Date().toISOString(),
                parse_status: 'pending',
            });
            toast.success('Resume uploaded — extracting profile details…');
            // Auto-extract after upload
            await runExtract();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed. PDF/DOCX up to 5 MB.');
        } finally {
            setUploading(false);
        }
    };

    // ── Extract profile from existing resume ───────────────────────────────────
    const runExtract = async () => {
        setExtracting(true);
        setExtracted(false);
        try {
            const { data } = await resumeAPI.extractProfile();
            const d = data.data;
            setForm({
                full_name:        d.full_name        || '',
                phone:            d.phone            || '',
                headline:         d.headline         || '',
                location:         d.location         || '',
                total_experience: d.experience_years != null ? String(d.experience_years) : '',
                linkedin_url:     d.linkedin_url     || '',
                portfolio_url:    d.portfolio_url    || '',
                summary:          d.summary          || '',
            });
            if (Array.isArray(d.education) && d.education.length) setEducation(d.education.map(e => ({
                degree:     e.degree      || '',
                institution:e.institution || '',
                field:      e.field       || '',
                start_year: e.start_year  ? String(e.start_year) : '',
                end_year:   e.end_year    ? String(e.end_year)   : '',
                grade:      e.grade       || '',
            })));
            if (Array.isArray(d.skills) && d.skills.length) setSkills(d.skills);
            setExtracted(true);
            toast.success('Profile extracted — review and save.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Extraction failed. Please fill manually.');
        } finally {
            setExtracting(false);
        }
    };

    // ── Save profile ───────────────────────────────────────────────────────────
    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await profileAPI.save({ ...form, education, skills });
            setExtracted(false);
            toast.success('Profile saved!');
        } catch {
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    // ── Download resume ────────────────────────────────────────────────────────
    const handleDownload = async () => {
        try {
            const res = await resumeAPI.download();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url; a.download = resume?.original_name || 'resume';
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch { toast.error('Download failed'); }
    };

    // ── Skills helpers ─────────────────────────────────────────────────────────
    const addSkill = () => {
        const s = skillInput.trim();
        if (s && !skills.includes(s)) setSkills(prev => [...prev, s]);
        setSkillInput('');
    };
    const removeSkill = (s) => setSkills(prev => prev.filter(x => x !== s));

    // ── Education helpers ──────────────────────────────────────────────────────
    const addEdu  = () => setEducation(prev => [...prev, { ...EMPTY_EDU }]);
    const updEdu  = (i, k, v) => setEducation(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
    const rmEdu   = (i) => setEducation(prev => prev.filter((_, idx) => idx !== i));

    const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading profile…</div>
    );

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h1>

            {/* ── Extracted banner ─────────────────────────────────────────── */}
            {extracted && (
                <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <span className="text-green-500 text-xl mt-0.5">✓</span>
                    <div>
                        <p className="text-sm font-semibold text-green-800">Profile extracted from resume</p>
                        <p className="text-xs text-green-600 mt-0.5">Review the details below and click Save Profile when ready.</p>
                    </div>
                </div>
            )}

            {/* ── Resume upload ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                <h2 className="font-semibold text-gray-800 mb-4">Resume</h2>

                {resume ? (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                        <span className="text-2xl">📄</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{resume.original_name || resume.file_name}</p>
                            <p className="text-xs text-gray-400">
                                Uploaded {new Date(resume.created_at).toLocaleDateString('en-IN')}
                                {resume.parse_status === 'done' ? ' · Parsed ✓' : ''}
                            </p>
                        </div>
                        <button type="button" onClick={handleDownload}
                            className="text-xs text-indigo-600 hover:underline shrink-0">
                            Download
                        </button>
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-4">
                        <p className="text-3xl mb-2">📄</p>
                        <p className="text-sm font-medium text-gray-700 mb-1">Upload your resume to auto-fill your profile</p>
                        <p className="text-xs text-gray-400">PDF or DOCX · up to 5 MB</p>
                    </div>
                )}

                <input type="file" ref={fileRef} accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
                <div className="flex gap-3 flex-wrap">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || extracting}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                        {uploading ? 'Uploading…' : resume ? 'Replace Resume' : 'Upload Resume'}
                    </button>
                    {resume && (
                        <button type="button" onClick={runExtract} disabled={extracting || uploading}
                            className="border border-indigo-300 text-indigo-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-50 disabled:opacity-50 transition">
                            {extracting ? 'Extracting…' : 'Re-extract from Resume'}
                        </button>
                    )}
                </div>

                {extracting && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-indigo-600">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Analysing resume and extracting profile details…
                    </div>
                )}
            </div>

            {/* ── Profile form ─────────────────────────────────────────────── */}
            <form onSubmit={handleSave} className="space-y-6">

                {/* Basic info */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Full Name" value={form.full_name} onChange={f('full_name')} placeholder="Jane Doe" />
                        <Field label="Phone" value={form.phone} onChange={f('phone')} placeholder="+91 98765 43210" />
                        <Field label="Professional Headline" value={form.headline} onChange={f('headline')} placeholder="Senior Software Engineer" span2 />
                        <Field label="Location" value={form.location} onChange={f('location')} placeholder="Bengaluru, India" />
                        <Field label="Years of Experience" value={form.total_experience} onChange={f('total_experience')} type="number" min="0" step="0.5" placeholder="4.5" />
                        <Field label="LinkedIn URL" value={form.linkedin_url} onChange={f('linkedin_url')} placeholder="https://linkedin.com/in/…" />
                        <Field label="Portfolio / GitHub URL" value={form.portfolio_url} onChange={f('portfolio_url')} placeholder="https://github.com/…" span2 />
                    </div>
                    <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Professional Summary</label>
                        <textarea
                            value={form.summary} onChange={f('summary')} rows={4}
                            placeholder="Brief overview of your experience, skills, and goals…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Skills */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Skills</h2>
                    <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                        {skills.length === 0 && (
                            <p className="text-sm text-gray-400">No skills added yet.</p>
                        )}
                        {skills.map((s) => (
                            <span key={s} className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-sm">
                                {s}
                                <button type="button" onClick={() => removeSkill(s)}
                                    className="text-blue-400 hover:text-blue-700 ml-0.5 leading-none text-base">×</button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={skillInput}
                            onChange={e => setSkillInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                            placeholder="Type a skill and press Enter…"
                            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={addSkill} disabled={!skillInput.trim()}
                            className="border border-gray-300 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                            Add
                        </button>
                    </div>
                </div>

                {/* Education */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-800">Education</h2>
                        <button type="button" onClick={addEdu}
                            className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50">
                            + Add
                        </button>
                    </div>
                    {education.length === 0 && (
                        <p className="text-sm text-gray-400">No education added yet.</p>
                    )}
                    <div className="space-y-3">
                        {education.map((edu, i) => (
                            <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Field label="Degree" value={edu.degree} onChange={e => updEdu(i, 'degree', e.target.value)} placeholder="B.Tech" sm />
                                    <Field label="Institution" value={edu.institution} onChange={e => updEdu(i, 'institution', e.target.value)} placeholder="University name" sm />
                                    <Field label="Field of Study" value={edu.field} onChange={e => updEdu(i, 'field', e.target.value)} placeholder="Computer Science" sm />
                                    <Field label="Grade / CGPA" value={edu.grade} onChange={e => updEdu(i, 'grade', e.target.value)} placeholder="8.5" sm />
                                    <Field label="Start Year" value={edu.start_year} onChange={e => updEdu(i, 'start_year', e.target.value)} type="number" placeholder="2018" sm />
                                    <Field label="End Year" value={edu.end_year} onChange={e => updEdu(i, 'end_year', e.target.value)} type="number" placeholder="2022" sm />
                                </div>
                                <button type="button" onClick={() => rmEdu(i)}
                                    className="text-xs text-red-400 hover:text-red-600 mt-2">
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" disabled={saving}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition">
                    {saving ? 'Saving…' : 'Save Profile'}
                </button>
            </form>
        </div>
    );
}

// Small reusable field component
function Field({ label, value, onChange, placeholder, type = 'text', min, step, span2, sm }) {
    const base = sm
        ? 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'
        : 'w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
    const labelCls = sm ? 'block text-xs font-medium text-gray-500 mb-1' : 'block text-xs font-medium text-gray-600 mb-1';
    return (
        <div className={span2 ? 'md:col-span-2' : ''}>
            <label className={labelCls}>{label}</label>
            <input type={type} value={value} onChange={onChange} placeholder={placeholder}
                min={min} step={step} className={base} />
        </div>
    );
}
