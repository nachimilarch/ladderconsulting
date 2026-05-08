import { useEffect, useState, useRef } from 'react';
import { profileAPI, resumeAPI } from '../../api/candidate';

export default function CandidateProfile() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const fileRef = useRef(null);

    const [form, setForm] = useState({
        full_name: '', phone: '', location: '', linkedin_url: '', portfolio_url: '',
        summary: '', total_experience: '', current_salary: '', expected_salary: '', notice_period: '',
    });
    const [education, setEducation] = useState([]);
    const [experience, setExperience] = useState([]);
    const [skills, setSkills] = useState([]);
    const [resume, setResume] = useState(null);

    useEffect(() => {
        profileAPI.get()
            .then(({ data }) => {
                if (data.profile) {
                    setForm({
                        full_name: data.profile.full_name || '',
                        phone: data.profile.phone || '',
                        location: data.profile.location || '',
                        linkedin_url: data.profile.linkedin_url || '',
                        portfolio_url: data.profile.portfolio_url || '',
                        summary: data.profile.summary || '',
                        total_experience: data.profile.total_experience || '',
                        current_salary: data.profile.current_salary || '',
                        expected_salary: data.profile.expected_salary || '',
                        notice_period: data.profile.notice_period || '',
                    });
                }
                setEducation(data.education || []);
                setExperience(data.experience || []);
                setSkills(data.skills || []);
                setResume(data.resume || null);
            })
            .catch(() => setMsg({ type: 'error', text: 'Failed to load profile' }))
            .finally(() => setLoading(false));
    }, []);

    const flash = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: '', text: '' }), 4000);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await profileAPI.save({ ...form, education, experience });
            flash('success', 'Profile saved successfully!');
        } catch {
            flash('error', 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            await resumeAPI.upload(file);
            setResume({ original_name: file.name, created_at: new Date().toISOString() });
            flash('success', 'Resume uploaded!');
        } catch {
            flash('error', 'Upload failed. Only PDF/DOCX up to 5MB.');
        } finally {
            setUploading(false);
        }
    };

    const handleParse = async () => {
        setParsing(true);
        try {
            const { data } = await resumeAPI.parse();
            if (data.skills) setSkills(data.skills);
            flash('success', `Resume parsed — ${data.skills?.length || 0} skills extracted!`);
        } catch {
            flash('error', 'Parsing failed');
        } finally {
            setParsing(false);
        }
    };

    // Education helpers
    const addEducation = () => setEducation([...education, { degree: '', institution: '', field: '', start_year: '', end_year: '', grade: '' }]);
    const updateEdu = (i, key, val) => { const ed = [...education]; ed[i][key] = val; setEducation(ed); };
    const removeEdu = (i) => setEducation(education.filter((_, idx) => idx !== i));

    // Experience helpers
    const addExperience = () => setExperience([...experience, { company: '', title: '', start_date: '', end_date: '', is_current: false, description: '' }]);
    const updateExp = (i, key, val) => { const ex = [...experience]; ex[i][key] = val; setExperience(ex); };
    const removeExp = (i) => setExperience(experience.filter((_, idx) => idx !== i));

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading profile...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto animate-slide-up">
            <div className="page-header">
                <h1 className="page-title">My Profile</h1>
            </div>

            {msg.text && (
                <div className={`mb-5 ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                    {msg.text}
                </div>
            )}

            <form onSubmit={handleSave}>
                {/* ── Basic Info ────────────────────── */}
                <div className="card-p mb-5">
                    <h3 className="section-title">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="John Doe" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91 98765 43210" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <input className="form-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Bangalore, India" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Total Experience (years)</label>
                            <input className="form-input" type="number" step="0.5" value={form.total_experience} onChange={e => setForm({...form, total_experience: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">LinkedIn URL</label>
                            <input className="form-input" value={form.linkedin_url} onChange={e => setForm({...form, linkedin_url: e.target.value})} placeholder="https://linkedin.com/in/..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Portfolio URL</label>
                            <input className="form-input" value={form.portfolio_url} onChange={e => setForm({...form, portfolio_url: e.target.value})} placeholder="https://..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Current Salary (LPA)</label>
                            <input className="form-input" type="number" value={form.current_salary} onChange={e => setForm({...form, current_salary: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Expected Salary (LPA)</label>
                            <input className="form-input" type="number" value={form.expected_salary} onChange={e => setForm({...form, expected_salary: e.target.value})} />
                        </div>
                        <div className="form-group md:col-span-2">
                            <label className="form-label">Notice Period (days)</label>
                            <input className="form-input" type="number" value={form.notice_period} onChange={e => setForm({...form, notice_period: e.target.value})} />
                        </div>
                    </div>
                    <div className="form-group mt-4">
                        <label className="form-label">Professional Summary</label>
                        <textarea className="form-textarea" rows={4} value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} placeholder="Brief overview of your experience and goals..." />
                    </div>
                </div>

                {/* ── Education ────────────────────── */}
                <div className="card-p mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="section-title mb-0">Education</h3>
                        <button type="button" onClick={addEducation} className="btn-secondary text-xs">+ Add</button>
                    </div>
                    {education.length === 0 && <p className="text-sm text-gray-400">No education added yet.</p>}
                    {education.map((edu, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-4 mb-3 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="form-group">
                                    <label className="form-label-xs">Degree</label>
                                    <input className="form-input-sm" value={edu.degree} onChange={e => updateEdu(i, 'degree', e.target.value)} placeholder="B.Tech" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">Institution</label>
                                    <input className="form-input-sm" value={edu.institution} onChange={e => updateEdu(i, 'institution', e.target.value)} placeholder="University name" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">Field</label>
                                    <input className="form-input-sm" value={edu.field} onChange={e => updateEdu(i, 'field', e.target.value)} placeholder="Computer Science" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">Grade</label>
                                    <input className="form-input-sm" value={edu.grade} onChange={e => updateEdu(i, 'grade', e.target.value)} placeholder="8.5 CGPA" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">Start Year</label>
                                    <input className="form-input-sm" type="number" value={edu.start_year} onChange={e => updateEdu(i, 'start_year', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">End Year</label>
                                    <input className="form-input-sm" type="number" value={edu.end_year} onChange={e => updateEdu(i, 'end_year', e.target.value)} />
                                </div>
                            </div>
                            <button type="button" onClick={() => removeEdu(i)} className="text-link-danger mt-2">Remove</button>
                        </div>
                    ))}
                </div>

                {/* ── Experience ───────────────────── */}
                <div className="card-p mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="section-title mb-0">Experience</h3>
                        <button type="button" onClick={addExperience} className="btn-secondary text-xs">+ Add</button>
                    </div>
                    {experience.length === 0 && <p className="text-sm text-gray-400">No experience added yet.</p>}
                    {experience.map((exp, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-4 mb-3 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="form-group">
                                    <label className="form-label-xs">Company</label>
                                    <input className="form-input-sm" value={exp.company} onChange={e => updateExp(i, 'company', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">Title / Role</label>
                                    <input className="form-input-sm" value={exp.title} onChange={e => updateExp(i, 'title', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">Start Date</label>
                                    <input className="form-input-sm" type="date" value={exp.start_date} onChange={e => updateExp(i, 'start_date', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-xs">End Date</label>
                                    <input className="form-input-sm" type="date" value={exp.end_date} onChange={e => updateExp(i, 'end_date', e.target.value)} disabled={exp.is_current} />
                                </div>
                                <div className="flex items-center gap-2 md:col-span-2">
                                    <input type="checkbox" checked={exp.is_current} onChange={e => updateExp(i, 'is_current', e.target.checked)} />
                                    <label className="text-sm text-gray-600">Currently working here</label>
                                </div>
                                <div className="form-group md:col-span-2">
                                    <label className="form-label-xs">Description</label>
                                    <textarea className="form-textarea" rows={2} value={exp.description} onChange={e => updateExp(i, 'description', e.target.value)} />
                                </div>
                            </div>
                            <button type="button" onClick={() => removeExp(i)} className="text-link-danger mt-2">Remove</button>
                        </div>
                    ))}
                </div>

                {/* ── Skills ──────────────────────── */}
                <div className="card-p mb-5">
                    <h3 className="section-title">Skills</h3>
                    {skills.length === 0 ? (
                        <p className="text-sm text-gray-400">Upload and parse your resume to auto-extract skills.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {skills.map((s) => (
                                <span key={s.skill_id || s.id} className="badge-blue">
                                    {s.skill_name || s.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Resume ──────────────────────── */}
                <div className="card-p mb-6">
                    <h3 className="section-title">Resume</h3>
                    {resume ? (
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📄</span>
                            <div>
                                <div className="text-sm font-medium text-gray-800">{resume.original_name}</div>
                                <div className="text-xs text-gray-400">
                                    Uploaded {new Date(resume.created_at).toLocaleDateString()}
                                    {resume.parsed ? ' • Parsed ✓' : ''}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 mb-3">No resume uploaded yet.</p>
                    )}
                    <div className="flex gap-3">
                        <input type="file" ref={fileRef} accept=".pdf,.docx" className="hidden" onChange={handleUpload} />
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-xs">
                            {uploading ? 'Uploading...' : resume ? 'Replace Resume' : 'Upload Resume'}
                        </button>
                        {resume && !resume.parsed && (
                            <button type="button" onClick={handleParse} disabled={parsing} className="btn-secondary text-xs">
                                {parsing ? 'Parsing...' : '🤖 AI Parse Resume'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Save */}
                <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </form>
        </div>
    );
}
