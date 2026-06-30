import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { myTrainingAPI } from '../../api/training';

export default function CertificatePage() {
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        myTrainingAPI.getCertificates()
            .then(({ data }) => setCertificates(data.certificates || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
                <Link to="/training" className="text-gray-400 hover:text-gray-700 text-sm">← Back</Link>
                <h1 className="text-2xl font-bold text-gray-900">My Certificates</h1>
            </div>

            {certificates.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <div className="text-5xl mb-4">🏆</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No certificates yet</h3>
                    <p className="text-sm text-gray-500">
                        Complete all modules and pass the quiz in a course to earn your certificate.
                    </p>
                    <Link to="/training"
                        className="mt-6 inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                        Go to Training
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {certificates.map(cert => (
                        <div key={cert.id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4">
                            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-2xl shrink-0">
                                🏆
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 mb-0.5">{cert.course_title}</h3>
                                {cert.level && (
                                    <span className="text-xs text-gray-400 capitalize">{cert.level}</span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    Issued: {new Date(cert.issued_at).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </p>
                                <p className="text-xs text-gray-300 mt-0.5">ID: {cert.id}</p>
                                <a
                                    href={cert.download_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-block text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
                                >
                                    Download PDF
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
