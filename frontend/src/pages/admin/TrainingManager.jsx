import { useEffect, useState } from 'react';
import { adminTrainingAPI } from '../../api/training';
import { adminTrainingServiceAPI } from '../../api/trainingServices';
import toast from 'react-hot-toast';

// ── Shared helpers ────────────────────────────────────────────────────────────
const fmtINR  = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const CATEGORY_COLORS = {
    'Onboarding':     'bg-green-100 text-green-700',
    'Culture':        'bg-purple-100 text-purple-700',
    'Professionalism':'bg-blue-100 text-blue-700',
    'Communication':  'bg-indigo-100 text-indigo-700',
    'Leadership':     'bg-orange-100 text-orange-700',
    'Sales':          'bg-red-100 text-red-700',
};

const CATEGORIES = ['Onboarding', 'Culture', 'Professionalism', 'Communication', 'Leadership', 'Sales'];

const EMPTY_CATALOGUE = { title: '', description: '', category: 'Onboarding', duration_days: '', price_per_user: '' };
const EMPTY_COURSE    = { title: '', description: '', roleTarget: '', estimatedHours: '', level: 'beginner', is_published: false };
const EMPTY_MODULE    = { title: '', type: 'video', contentUrl: '', quizData: '', durationMins: '', passScore: 70 };
const EMPTY_BENCHMARK = { jobTitle: '', skills: '' };

const TABS = ['Training Catalogue', 'Company Requests', 'Internal Courses', 'Benchmarks', 'Assignments', 'Progress'];

const REQ_STATUS_CLS = {
    pending:   'bg-yellow-100 text-yellow-700',
    approved:  'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-600',
    completed: 'bg-indigo-100 text-indigo-700',
};

// ── Small shared components ───────────────────────────────────────────────────
const EmptyState = ({ icon, text }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
        {icon && <div className="text-4xl mb-3">{icon}</div>}
        <p className="text-gray-400 text-sm">{text}</p>
    </div>
);

const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">{title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

const inp = 'border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full';

// ─────────────────────────────────────────────────────────────────────────────
export default function TrainingManager() {
    const [tab, setTab] = useState('Training Catalogue');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    // ── Training Catalogue ────────────────────────────────────────────────────
    const [catalogue,    setCatalogue]    = useState([]);
    const [catModal,     setCatModal]     = useState(null); // null | 'add' | item (edit)
    const [catForm,      setCatForm]      = useState(EMPTY_CATALOGUE);
    const [savingCat,    setSavingCat]    = useState(false);

    // ── Company Requests ──────────────────────────────────────────────────────
    const [companyReqs,  setCompanyReqs]  = useState([]);
    const [reqFilter,    setReqFilter]    = useState('');
    const [rejectModal,  setRejectModal]  = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actioning,    setActioning]    = useState(false);

    // ── Internal Courses ──────────────────────────────────────────────────────
    const [courses,         setCourses]         = useState([]);
    const [showCourseForm,  setShowCourseForm]  = useState(false);
    const [courseForm,      setCourseForm]      = useState(EMPTY_COURSE);
    const [savingCourse,    setSavingCourse]    = useState(false);
    const [expandedCourse,  setExpandedCourse]  = useState(null);
    const [courseModules,   setCourseModules]   = useState({});
    const [moduleForCourse, setModuleForCourse] = useState(null);
    const [moduleForm,      setModuleForm]      = useState(EMPTY_MODULE);
    const [savingModule,    setSavingModule]    = useState(false);

    // ── Benchmarks ────────────────────────────────────────────────────────────
    const [benchmarks,       setBenchmarks]       = useState([]);
    const [showBenchmarkForm,setShowBenchmarkForm] = useState(false);
    const [benchmarkForm,    setBenchmarkForm]     = useState(EMPTY_BENCHMARK);
    const [savingBenchmark,  setSavingBenchmark]  = useState(false);

    // ── Assignments / Progress ────────────────────────────────────────────────
    const [assignments, setAssignments] = useState([]);

    // ── Load ──────────────────────────────────────────────────────────────────
    const loadTab = async (t) => {
        setLoading(true);
        setError('');
        try {
            if (t === 'Training Catalogue') {
                const r = await adminTrainingServiceAPI.getCatalogue();
                setCatalogue(r.data?.data || []);
            } else if (t === 'Company Requests') {
                const r = await adminTrainingServiceAPI.listRequests(reqFilter ? { status: reqFilter } : {});
                setCompanyReqs(r.data?.data || []);
            } else if (t === 'Internal Courses') {
                const { data } = await adminTrainingAPI.getCourses();
                setCourses(data.courses || []);
            } else if (t === 'Benchmarks') {
                const { data } = await adminTrainingAPI.getBenchmarks();
                setBenchmarks(data.benchmarks || []);
            } else if (t === 'Assignments' || t === 'Progress') {
                const { data } = await adminTrainingAPI.getAllAssignments();
                setAssignments(data.assignments || []);
            }
        } catch {
            setError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTab(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Catalogue handlers ────────────────────────────────────────────────────
    const openAddCat = () => { setCatForm(EMPTY_CATALOGUE); setCatModal('add'); };
    const openEditCat = (item) => {
        setCatForm({
            title:         item.title,
            description:   item.description || '',
            category:      item.category || 'Onboarding',
            duration_days: item.duration_days ?? '',
            price_per_user: item.price_per_user,
        });
        setCatModal(item);
    };

    const handleSaveCat = async (e) => {
        e.preventDefault();
        setSavingCat(true);
        try {
            const payload = {
                title:        catForm.title,
                description:  catForm.description || null,
                category:     catForm.category,
                duration_days: catForm.duration_days ? Number(catForm.duration_days) : null,
                price_per_user: Number(catForm.price_per_user),
            };
            if (catModal === 'add') {
                await adminTrainingServiceAPI.createCatalogueItem(payload);
                toast.success('Training topic added.');
            } else {
                await adminTrainingServiceAPI.updateCatalogueItem(catModal.id, payload);
                toast.success('Training topic updated.');
            }
            setCatModal(null);
            loadTab('Training Catalogue');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save topic.');
        } finally {
            setSavingCat(false); }
    };

    const handleToggleCat = async (item) => {
        try {
            await adminTrainingServiceAPI.toggleCatalogueItem(item.id);
            setCatalogue(prev => prev.map(c => c.id === item.id ? { ...c, is_active: c.is_active ? 0 : 1 } : c));
        } catch {
            toast.error('Failed to toggle status.');
        }
    };

    const cf = (k) => (e) => setCatForm(f => ({ ...f, [k]: e.target.value }));

    // ── Company request handlers ───────────────────────────────────────────────
    const handleApprove = async (id) => {
        setActioning(true);
        try {
            await adminTrainingServiceAPI.approveRequest(id, {});
            toast.success('Approved — invoice raised.');
            loadTab('Company Requests');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve.');
        } finally { setActioning(false); }
    };

    const handleReject = async (e) => {
        e.preventDefault();
        setActioning(true);
        try {
            await adminTrainingServiceAPI.rejectRequest(rejectModal.id, { rejection_reason: rejectReason });
            toast.success('Request rejected.');
            setRejectModal(null);
            setRejectReason('');
            loadTab('Company Requests');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject.');
        } finally { setActioning(false); }
    };

    // ── Internal course handlers ──────────────────────────────────────────────
    const icf = (k) => (e) => setCourseForm(f => ({ ...f, [k]: e.target.value }));
    const imf = (k) => (e) => setModuleForm(f => ({ ...f, [k]: e.target.value }));

    const handleCreateCourse = async (e) => {
        e.preventDefault();
        setSavingCourse(true);
        try {
            await adminTrainingAPI.createCourse(courseForm);
            setShowCourseForm(false);
            setCourseForm(EMPTY_COURSE);
            loadTab('Internal Courses');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create course.');
        } finally { setSavingCourse(false); }
    };

    const handleTogglePublish = async (course) => {
        try {
            await adminTrainingAPI.updateCourse(course.id, { is_published: !course.is_published });
            loadTab('Internal Courses');
        } catch { toast.error('Failed to update.'); }
    };

    const handleDeleteCourse = async (id) => {
        if (!window.confirm('Delete this course?')) return;
        try {
            await adminTrainingAPI.deleteCourse(id);
            loadTab('Internal Courses');
        } catch { toast.error('Failed to delete.'); }
    };

    const handleExpandCourse = async (courseId) => {
        if (expandedCourse === courseId) { setExpandedCourse(null); return; }
        setExpandedCourse(courseId);
        if (!courseModules[courseId]) {
            try {
                const { data } = await adminTrainingAPI.getCourse(courseId);
                setCourseModules(m => ({ ...m, [courseId]: data.modules || [] }));
            } catch { }
        }
    };

    const handleAddModule = async (e) => {
        e.preventDefault();
        setSavingModule(true);
        try {
            let quizData;
            if (moduleForm.type === 'quiz' && moduleForm.quizData) {
                try { quizData = JSON.parse(moduleForm.quizData); }
                catch { toast.error('Invalid quiz JSON.'); setSavingModule(false); return; }
            }
            await adminTrainingAPI.addModule(moduleForCourse, {
                ...moduleForm,
                quizData,
                contentUrl: moduleForm.type !== 'quiz' ? moduleForm.contentUrl : undefined,
            });
            setModuleForCourse(null);
            setModuleForm(EMPTY_MODULE);
            setCourseModules(m => ({ ...m, [moduleForCourse]: undefined }));
            handleExpandCourse(moduleForCourse);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add module.');
        } finally { setSavingModule(false); }
    };

    const handleDeleteModule = async (courseId, moduleId) => {
        if (!window.confirm('Delete this module?')) return;
        try {
            await adminTrainingAPI.deleteModule(moduleId);
            setCourseModules(m => ({ ...m, [courseId]: m[courseId]?.filter(mod => mod.id !== moduleId) }));
        } catch { toast.error('Failed to delete.'); }
    };

    // ── Benchmark handlers ────────────────────────────────────────────────────
    const handleCreateBenchmark = async (e) => {
        e.preventDefault();
        setSavingBenchmark(true);
        try {
            const skills = benchmarkForm.skills.split(',').map(s => s.trim()).filter(Boolean);
            await adminTrainingAPI.createBenchmark({ jobTitle: benchmarkForm.jobTitle, requiredSkills: skills });
            setShowBenchmarkForm(false);
            setBenchmarkForm(EMPTY_BENCHMARK);
            loadTab('Benchmarks');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create benchmark.');
        } finally { setSavingBenchmark(false); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-6xl mx-auto p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Training Manager</h1>

            {/* Tabs */}
            <div className="flex flex-wrap gap-0 mb-6 border-b border-gray-200">
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                            tab === t
                                ? 'text-indigo-700 border-b-2 border-indigo-600 -mb-px bg-indigo-50/50'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        {t}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : (
                <>
                {/* ── TRAINING CATALOGUE ─────────────────────────────────── */}
                {tab === 'Training Catalogue' && (
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <p className="text-sm text-gray-500">{catalogue.length} topics · shown to hiring companies</p>
                            </div>
                            <button onClick={openAddCat}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                                + Add Topic
                            </button>
                        </div>

                        {catalogue.length === 0 ? (
                            <EmptyState icon="🎓" text="No training topics in catalogue yet." />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {catalogue.map(item => (
                                    <div key={item.id}
                                        className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${!item.is_active ? 'opacity-60' : ''}`}>

                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-semibold text-gray-800 text-base leading-tight">{item.title}</h3>
                                            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>
                                                {item.category}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-3">{item.description}</p>

                                        {/* Meta */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            {item.duration_days && (
                                                <span>⏱ {item.duration_days} day{item.duration_days > 1 ? 's' : ''}</span>
                                            )}
                                            <span className="font-semibold text-indigo-700">
                                                {fmtINR(item.price_per_user)} / user
                                            </span>
                                        </div>

                                        {/* Admin actions */}
                                        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                            <button onClick={() => openEditCat(item)}
                                                className="flex-1 py-1.5 text-xs font-medium border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50">
                                                Edit
                                            </button>
                                            <button onClick={() => handleToggleCat(item)}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                                                    item.is_active
                                                        ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                                        : 'border-green-200 text-green-600 hover:bg-green-50'
                                                }`}>
                                                {item.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                            {!item.is_active && (
                                                <span className="text-[10px] text-gray-400 px-1">Hidden</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add / Edit modal */}
                        {catModal && (
                            <Modal
                                title={catModal === 'add' ? 'Add Training Topic' : `Edit — ${catModal.title}`}
                                onClose={() => setCatModal(null)}
                            >
                                <form onSubmit={handleSaveCat} className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                                        <input value={catForm.title} onChange={cf('title')} required className={inp} placeholder="e.g. Sales Basics" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                                        <textarea value={catForm.description} onChange={cf('description')} rows={3}
                                            className={inp} placeholder="What will participants learn?" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                                            <select value={catForm.category} onChange={cf('category')} className={inp}>
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Duration (days)</label>
                                            <input type="number" min={1} value={catForm.duration_days} onChange={cf('duration_days')}
                                                className={inp} placeholder="e.g. 3" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Price per user (₹) *</label>
                                        <input type="number" min={0} step={100} value={catForm.price_per_user} onChange={cf('price_per_user')}
                                            required className={inp} placeholder="e.g. 5000" />
                                        {catForm.price_per_user && (
                                            <p className="text-xs text-indigo-600 mt-1">{fmtINR(catForm.price_per_user)} per user</p>
                                        )}
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button type="submit" disabled={savingCat}
                                            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                            {savingCat ? 'Saving…' : catModal === 'add' ? 'Add Topic' : 'Save Changes'}
                                        </button>
                                        <button type="button" onClick={() => setCatModal(null)}
                                            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </Modal>
                        )}
                    </div>
                )}

                {/* ── COMPANY REQUESTS ───────────────────────────────────── */}
                {tab === 'Company Requests' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500">Training subscription requests from hiring companies</p>
                            <select value={reqFilter}
                                onChange={e => { setReqFilter(e.target.value); }}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        {companyReqs.length === 0 ? (
                            <EmptyState text="No training requests found." />
                        ) : (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Company</th>
                                            <th className="px-4 py-3 text-left">Topic</th>
                                            <th className="px-4 py-3 text-center">Users</th>
                                            <th className="px-4 py-3 text-right">Total Fee</th>
                                            <th className="px-4 py-3 text-left">Status</th>
                                            <th className="px-4 py-3 text-left">Invoice</th>
                                            <th className="px-4 py-3 text-left">Requested</th>
                                            <th className="px-4 py-3 text-left">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {companyReqs.map(r => (
                                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-800">{r.company_name}</p>
                                                    <p className="text-xs text-gray-400">{r.requested_by_email}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-700">{r.topic_title}</p>
                                                    <p className="text-xs text-gray-400">{r.category} · {r.duration_days}d</p>
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-700">{r.num_users}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                                    {fmtINR(parseFloat(r.price_per_user) * r.num_users)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REQ_STATUS_CLS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                                                        {r.status}
                                                    </span>
                                                    {r.status === 'rejected' && r.rejection_reason && (
                                                        <p className="text-xs text-red-400 mt-0.5">{r.rejection_reason}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    {r.invoice_number ? (
                                                        <div>
                                                            <p className="font-mono">{r.invoice_number}</p>
                                                            <p className={r.invoice_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                                                                {r.invoice_status}
                                                            </p>
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    {r.status === 'pending' && (
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleApprove(r.id)} disabled={actioning}
                                                                className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                                                                Approve
                                                            </button>
                                                            <button onClick={() => { setRejectModal({ id: r.id, companyName: r.company_name, topic: r.topic_title }); setRejectReason(''); }}
                                                                disabled={actioning}
                                                                className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── INTERNAL COURSES ───────────────────────────────────── */}
                {tab === 'Internal Courses' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-gray-500">{courses.length} courses · assigned to hired candidates</p>
                            <button onClick={() => { setShowCourseForm(true); setError(''); }}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                                + Add Course
                            </button>
                        </div>

                        {courses.length === 0 ? (
                            <EmptyState icon="📚" text="No courses yet. Create your first course." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {courses.map(course => (
                                    <div key={course.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                                        <div className="p-4 flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-gray-900">{course.title}</h3>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {course.is_published ? 'Published' : 'Draft'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 capitalize">{course.level}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {course.skill_tag && <span>{course.skill_tag} · </span>}
                                                    {course.module_count} module{course.module_count !== 1 ? 's' : ''}
                                                    {course.duration_hrs && ` · ${course.duration_hrs}h`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button onClick={() => { setModuleForCourse(course.id); setModuleForm(EMPTY_MODULE); }}
                                                    className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50">
                                                    + Module
                                                </button>
                                                <button onClick={() => handleTogglePublish(course)}
                                                    className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                                                    {course.is_published ? 'Unpublish' : 'Publish'}
                                                </button>
                                                <button onClick={() => handleExpandCourse(course.id)}
                                                    className="text-xs text-gray-400 hover:text-gray-700 w-5 text-center">
                                                    {expandedCourse === course.id ? '▲' : '▼'}
                                                </button>
                                                <button onClick={() => handleDeleteCourse(course.id)}
                                                    className="text-xs text-red-400 hover:text-red-600">✕</button>
                                            </div>
                                        </div>

                                        {expandedCourse === course.id && (
                                            <div className="border-t border-gray-100 px-4 py-3">
                                                {!courseModules[course.id] ? (
                                                    <p className="text-xs text-gray-400">Loading modules…</p>
                                                ) : courseModules[course.id].length === 0 ? (
                                                    <p className="text-xs text-gray-400">No modules yet.</p>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {courseModules[course.id].map((m, i) => (
                                                            <div key={m.id} className="flex items-center gap-3 text-sm text-gray-600">
                                                                <span className="text-gray-300 text-xs w-4">{i + 1}.</span>
                                                                <span className="flex-1">{m.title}</span>
                                                                <span className="text-xs text-gray-400 capitalize">{m.content_type}</span>
                                                                {m.duration_mins > 0 && <span className="text-xs text-gray-300">{m.duration_mins}min</span>}
                                                                <button onClick={() => handleDeleteModule(course.id, m.id)}
                                                                    className="text-xs text-red-400 hover:text-red-600">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── BENCHMARKS ─────────────────────────────────────────── */}
                {tab === 'Benchmarks' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-gray-500">{benchmarks.length} role benchmark{benchmarks.length !== 1 ? 's' : ''}</p>
                            <button onClick={() => { setShowBenchmarkForm(true); setError(''); }}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                                + Add Benchmark
                            </button>
                        </div>

                        {benchmarks.length === 0 ? (
                            <EmptyState icon="🎯" text="No benchmarks defined. Add one to auto-assign courses to new hires." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {benchmarks.map(bm => (
                                    <div key={bm.role_title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                                        <h3 className="font-semibold text-gray-900 mb-2">{bm.role_title}</h3>
                                        <div className="flex flex-wrap gap-1">
                                            {bm.skills.map(s => (
                                                <span key={s.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                                    {s.skill_name}
                                                    <span className="text-blue-400 ml-1">({s.min_level})</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── ASSIGNMENTS ────────────────────────────────────────── */}
                {tab === 'Assignments' && (
                    <div>
                        <p className="text-sm text-gray-500 mb-4">{assignments.length} total assignment{assignments.length !== 1 ? 's' : ''}</p>
                        {assignments.length === 0 ? (
                            <EmptyState text="No training assignments yet." />
                        ) : (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                        <tr>
                                            {['Employee', 'Company', 'Course', 'Type', 'Status', 'Progress', 'Assigned'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {assignments.map(a => (
                                            <tr key={a.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-800">{a.candidate_name}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{a.company_name}</td>
                                                <td className="px-4 py-3 text-gray-700">{a.course_title}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500 capitalize">{a.assignment_type?.replace('_', ' ')}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                        a.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        a.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>{a.status}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                                            <div className={`h-1.5 rounded-full ${a.status === 'completed' ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                                style={{ width: `${a.progress_pct}%` }} />
                                                        </div>
                                                        <span className="text-xs text-gray-400">{a.progress_pct}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-400">
                                                    {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── PROGRESS MONITOR ───────────────────────────────────── */}
                {tab === 'Progress' && (
                    <div>
                        <p className="text-sm text-gray-500 mb-4">Per-employee training progress overview</p>
                        {assignments.length === 0 ? (
                            <EmptyState text="No assignment data yet." />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {Object.entries(
                                    assignments.reduce((acc, a) => {
                                        const key = `${a.candidate_name}__${a.company_name}`;
                                        if (!acc[key]) acc[key] = { name: a.candidate_name, company: a.company_name, courses: [] };
                                        acc[key].courses.push(a);
                                        return acc;
                                    }, {})
                                ).map(([key, emp]) => {
                                    const total = emp.courses.length;
                                    const done  = emp.courses.filter(c => c.status === 'completed').length;
                                    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                                    return (
                                        <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{emp.name}</h3>
                                                    <p className="text-xs text-gray-400">{emp.company}</p>
                                                </div>
                                                <span className="text-sm font-bold text-indigo-600">{pct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                                                <div className={`h-2 rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {emp.courses.map(c => (
                                                    <span key={c.id} className={`text-xs px-2 py-0.5 rounded-full ${
                                                        c.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {c.course_title} — {c.progress_pct}%
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                </>
            )}

            {/* ── MODALS (outside loading guard) ───────────────────────────── */}

            {/* Create internal course */}
            {showCourseForm && (
                <Modal title="New Internal Course" onClose={() => setShowCourseForm(false)}>
                    <form onSubmit={handleCreateCourse} className="flex flex-col gap-3">
                        <input value={courseForm.title} onChange={icf('title')} required
                            placeholder="Course title *" className={inp} />
                        <textarea value={courseForm.description} onChange={icf('description')}
                            rows={2} placeholder="Description" className={inp} />
                        <div className="grid grid-cols-2 gap-3">
                            <input value={courseForm.roleTarget} onChange={icf('roleTarget')}
                                placeholder="Skill tag (e.g. python)" className={inp} />
                            <input type="number" value={courseForm.estimatedHours} onChange={icf('estimatedHours')}
                                placeholder="Hours" className={inp} />
                        </div>
                        <select value={courseForm.level} onChange={icf('level')} className={inp}>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                        </select>
                        <div className="flex gap-3 pt-1">
                            <button type="submit" disabled={savingCourse}
                                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                {savingCourse ? 'Creating…' : 'Create Course'}
                            </button>
                            <button type="button" onClick={() => setShowCourseForm(false)}
                                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Add module */}
            {moduleForCourse && (
                <Modal title="Add Module" onClose={() => { setModuleForCourse(null); setModuleForm(EMPTY_MODULE); }}>
                    <form onSubmit={handleAddModule} className="flex flex-col gap-3">
                        <input value={moduleForm.title} onChange={imf('title')} required
                            placeholder="Module title *" className={inp} />
                        <div className="grid grid-cols-2 gap-3">
                            <select value={moduleForm.type} onChange={imf('type')} className={inp}>
                                <option value="video">Video</option>
                                <option value="pdf">PDF / Document</option>
                                <option value="article">Article</option>
                                <option value="quiz">Quiz</option>
                            </select>
                            <input type="number" value={moduleForm.durationMins} onChange={imf('durationMins')}
                                placeholder="Duration (min)" className={inp} />
                        </div>
                        {moduleForm.type !== 'quiz' ? (
                            <input value={moduleForm.contentUrl} onChange={imf('contentUrl')}
                                placeholder="Content URL (video link, PDF URL…)" className={inp} />
                        ) : (
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Quiz Questions (JSON array) *</label>
                                <textarea value={moduleForm.quizData} onChange={imf('quizData')}
                                    rows={6} required
                                    placeholder={`[{"q":"What is X?","choices":["A","B","C","D"],"correct":0}]`}
                                    className={`${inp} font-mono text-xs`} />
                            </div>
                        )}
                        {moduleForm.type === 'quiz' && (
                            <input type="number" value={moduleForm.passScore} onChange={imf('passScore')}
                                placeholder="Pass score % (default 70)" className={inp} />
                        )}
                        <div className="flex gap-3 pt-1">
                            <button type="submit" disabled={savingModule}
                                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                {savingModule ? 'Adding…' : 'Add Module'}
                            </button>
                            <button type="button" onClick={() => { setModuleForCourse(null); setModuleForm(EMPTY_MODULE); }}
                                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Create benchmark */}
            {showBenchmarkForm && (
                <Modal title="New Role Benchmark" onClose={() => { setShowBenchmarkForm(false); setBenchmarkForm(EMPTY_BENCHMARK); }}>
                    <form onSubmit={handleCreateBenchmark} className="flex flex-col gap-3">
                        <input value={benchmarkForm.jobTitle}
                            onChange={e => setBenchmarkForm(f => ({ ...f, jobTitle: e.target.value }))}
                            required placeholder="Job Title (e.g. Software Engineer)" className={inp} />
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Required Skills (comma-separated)</label>
                            <textarea value={benchmarkForm.skills}
                                onChange={e => setBenchmarkForm(f => ({ ...f, skills: e.target.value }))}
                                required rows={3} placeholder="python, sql, communication, git" className={inp} />
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="submit" disabled={savingBenchmark}
                                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                {savingBenchmark ? 'Saving…' : 'Create Benchmark'}
                            </button>
                            <button type="button" onClick={() => { setShowBenchmarkForm(false); setBenchmarkForm(EMPTY_BENCHMARK); }}
                                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Reject request */}
            {rejectModal && (
                <Modal title="Reject Training Request" onClose={() => setRejectModal(null)}>
                    <p className="text-sm text-gray-500 mb-4">{rejectModal.companyName} — {rejectModal.topic}</p>
                    <form onSubmit={handleReject} className="flex flex-col gap-4">
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (optional)" rows={3} className={inp} />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setRejectModal(null)}
                                className="flex-1 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" disabled={actioning}
                                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                                {actioning ? 'Rejecting…' : 'Reject'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
