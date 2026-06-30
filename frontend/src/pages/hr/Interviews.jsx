import { useState } from 'react';
import InterviewRequests from './InterviewRequests';
import ScheduledInterviews from './ScheduledInterviews';

const TABS = [
    { key: 'requests',  label: 'Pending Requests' },
    { key: 'scheduled', label: 'Scheduled' },
];

// Single "Interviews" tab for the executive — combines the approval queue
// (company-submitted requests) and the scheduled/upcoming interviews.
export default function Interviews() {
    const [tab, setTab] = useState('requests');

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Approve company interview requests, then notify candidates and run the interview.
                </p>
            </div>

            <div className="flex gap-1 mb-5 border-b border-gray-200">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition ${
                            tab === t.key
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'requests' ? <InterviewRequests embedded /> : <ScheduledInterviews embedded />}
        </div>
    );
}
