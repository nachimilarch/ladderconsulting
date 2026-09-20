import { useSearchParams } from 'react-router-dom';
import PremiumRequests from '../hr/PremiumRequests';
import PremiumCandidateRequests from '../hr/PremiumCandidateRequests';

// One place in the admin area for both approval queues. It reuses the same two
// screens executives use (Company Platinum requests, Candidate Premium
// verification), so approving here behaves exactly as it does under Hiring.
const TABS = [
    { id: 'companies', label: 'Company Platinum requests' },
    { id: 'candidates', label: 'Candidate Premium verification' },
];

export default function AdminPremiumRequests() {
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'candidates' ? 'candidates' : 'companies';

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Premium Requests</h2>
            <p className="text-sm text-gray-500 mb-6">
                Companies asking for Platinum and candidates waiting for Premium verification, across the whole platform.
            </p>

            <div className="flex gap-0 mb-6 border-b border-gray-200">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setParams({ tab: t.id })}
                        className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.id
                                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'companies' ? <PremiumRequests /> : <PremiumCandidateRequests />}
        </div>
    );
}
