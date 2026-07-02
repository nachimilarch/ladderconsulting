import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { hrDocumentAPI } from '../../api/candidate';
import toast from 'react-hot-toast';

const DOC_LABEL = {
    offer_letter:           'Offer Letter',
    aadhar_card:            'Aadhar Card',
    pan_card:               'PAN Card',
    class_10_marksheet:     '10th Marksheet',
    class_12_marksheet:     '12th Marksheet',
    graduation_certificate: 'Graduation Certificate',
    postgrad_certificate:   'Post-Graduation Certificate',
    experience_letter:      'Experience Letter',
    payslip:                'Payslip (Last 3 months)',
    bank_details:           'Cancelled Cheque / Bank Details',
    passport_photo:         'Passport Size Photo',
    other:                  'Other',
};

const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export default function CandidateDocumentsView() {
    const { candidateId } = useParams();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [candidateName, setCandidateName] = useState('');

    useEffect(() => {
        hrDocumentAPI.list(candidateId)
            .then(r => {
                const data = r.data?.data || [];
                setDocs(data);
                if (data.length > 0) setCandidateName(data[0].candidate_name || '');
            })
            .catch(() => toast.error('Failed to load documents'))
            .finally(() => setLoading(false));
    }, [candidateId]);

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-center gap-3">
                <Link to={-1} className="text-sm text-gray-400 hover:text-gray-600">← Back</Link>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                        Candidate Documents
                    </h2>
                    {candidateName && (
                        <p className="text-sm text-gray-500 mt-0.5">{candidateName}</p>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700">Uploaded Documents ({docs.length})</h3>
                    {docs.length > 0 && (
                        <span className="text-xs text-gray-400">Click "View" to open in a new tab</span>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
                ) : docs.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-400 text-sm">No documents uploaded by this candidate yet.</p>
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
                                        <p className="text-sm font-medium text-gray-800">
                                            {DOC_LABEL[doc.doc_type] || doc.doc_type}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">{doc.original_name}</p>
                                        {doc.notes && (
                                            <p className="text-xs text-gray-400 italic mt-0.5">{doc.notes}</p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {fmtSize(doc.file_size)} · Uploaded {fmtDate(doc.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <a
                                    href={hrDocumentAPI.downloadUrl(candidateId, doc.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:text-blue-700 ml-4 shrink-0 mt-1 font-medium"
                                >
                                    View ↗
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Document type checklist */}
            {docs.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-4">
                    <h3 className="font-semibold text-gray-700 mb-3 text-sm">Document Checklist</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(DOC_LABEL).filter(([k]) => k !== 'other').map(([key, label]) => {
                            const uploaded = docs.some(d => d.doc_type === key);
                            return (
                                <div key={key} className="flex items-center gap-2 text-sm">
                                    <span className={uploaded ? 'text-green-500' : 'text-gray-300'}>
                                        {uploaded ? '✓' : '○'}
                                    </span>
                                    <span className={uploaded ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
