import { useEffect, useRef, useState } from 'react';
import { documentAPI } from '../../api/candidate';
import toast from 'react-hot-toast';

const DOC_TYPES = [
    { value: 'offer_letter',        label: 'Offer Letter' },
    { value: 'aadhar_card',         label: 'Aadhar Card' },
    { value: 'pan_card',            label: 'PAN Card' },
    { value: 'class_10_marksheet',  label: '10th Marksheet' },
    { value: 'class_12_marksheet',  label: '12th Marksheet' },
    { value: 'graduation_certificate', label: 'Graduation Certificate' },
    { value: 'postgrad_certificate', label: 'Post-Graduation Certificate' },
    { value: 'experience_letter',   label: 'Experience Letter' },
    { value: 'payslip',             label: 'Payslip (Last 3 months)' },
    { value: 'bank_details',        label: 'Cancelled Cheque / Bank Details' },
    { value: 'passport_photo',      label: 'Passport Size Photo' },
    { value: 'other',               label: 'Other' },
];

const DOC_LABEL = Object.fromEntries(DOC_TYPES.map(d => [d.value, d.label]));

const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export default function CandidateDocuments() {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [docType, setDocType] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState(null);
    const fileRef = useRef();

    const load = () => {
        documentAPI.list()
            .then(r => setDocs(r.data?.data || []))
            .catch(() => toast.error('Failed to load documents'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !docType) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('doc_type', docType);
        if (notes) fd.append('notes', notes);
        setUploading(true);
        try {
            await documentAPI.upload(fd);
            toast.success('Document uploaded.');
            setFile(null);
            setDocType('');
            setNotes('');
            if (fileRef.current) fileRef.current.value = '';
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove "${name}"?`)) return;
        try {
            await documentAPI.remove(id);
            toast.success('Document removed.');
            setDocs(prev => prev.filter(d => d.id !== id));
        } catch {
            toast.error('Failed to remove document.');
        }
    };

    // Group uploaded docs by type for quick overview
    const uploadedTypes = new Set(docs.map(d => d.doc_type));

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Offer Letter & Documents</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                    Upload your offer letter and supporting documents required for onboarding.
                </p>
            </div>

            {/* Upload form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">Upload a Document</h3>
                <form onSubmit={handleUpload} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
                        <select
                            value={docType}
                            onChange={e => setDocType(e.target.value)}
                            required
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select document type…</option>
                            {DOC_TYPES.map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">File * <span className="font-normal text-gray-400">(PDF, DOC, DOCX, JPG, PNG — max 10 MB)</span></label>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            required
                            onChange={e => setFile(e.target.files[0] || null)}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="e.g. Issued by ABC Corp, March 2024"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={uploading || !file || !docType}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                            {uploading ? 'Uploading…' : 'Upload Document'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Required documents checklist */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">Document Checklist</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DOC_TYPES.filter(d => d.value !== 'other').map(d => (
                        <div key={d.value} className="flex items-center gap-2 text-sm">
                            {uploadedTypes.has(d.value)
                                ? <span className="text-green-500 text-base">✓</span>
                                : <span className="text-gray-300 text-base">○</span>
                            }
                            <span className={uploadedTypes.has(d.value) ? 'text-gray-700' : 'text-gray-400'}>
                                {d.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Uploaded documents list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-700">Uploaded Documents ({docs.length})</h3>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
                ) : docs.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
                        <p className="text-gray-400 text-xs mt-1">Use the form above to upload your documents.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {docs.map(doc => (
                            <div key={doc.id} className="flex items-start justify-between px-6 py-4 hover:bg-gray-50 transition">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl mt-0.5">
                                        {/image|jpg|jpeg|png/.test(doc.mime_type || '') ? '🖼️' : '📄'}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{DOC_LABEL[doc.doc_type] || doc.doc_type}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{doc.original_name}</p>
                                        {doc.notes && <p className="text-xs text-gray-400 italic mt-0.5">{doc.notes}</p>}
                                        <p className="text-xs text-gray-400 mt-0.5">{fmtSize(doc.file_size)} · Uploaded {fmtDate(doc.created_at)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 ml-4 shrink-0 mt-1">
                                    <a
                                        href={documentAPI.downloadUrl(doc.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:text-blue-700"
                                    >
                                        View
                                    </a>
                                    <button
                                        onClick={() => handleDelete(doc.id, doc.original_name)}
                                        className="text-xs text-red-400 hover:text-red-600"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
