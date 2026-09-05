import { useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
    {
        id: 'getting-started',
        icon: '🚀',
        title: 'Getting Started',
        color: 'indigo',
        steps: [
            {
                n: 1,
                title: 'Complete Your Company Profile',
                desc: 'Go to Profile in the sidebar and fill in your company name, industry, location, and description. This helps our team understand your hiring needs and enables proper matching.',
                link: '/company/profile',
                linkLabel: 'Go to Profile →',
            },
            {
                n: 2,
                title: 'Wait for Account Approval',
                desc: 'New company accounts are reviewed by the LadderStep team before you gain full access. You\'ll receive an email confirmation once approved. After approval, all features unlock automatically.',
            },
            {
                n: 3,
                title: 'Choose a Resume Package',
                desc: 'To access candidate profiles and resumes you need a resume package. Head to Talent Pool to choose: Single (₹999), 4-Pack (₹3,999), or request a Platinum engagement (fee at hire).',
                link: '/company/talent',
                linkLabel: 'Explore Talent Pool →',
            },
        ],
    },
    {
        id: 'talent-pool',
        icon: '👥',
        title: 'Talent Pool',
        color: 'violet',
        steps: [
            {
                n: 1,
                title: 'Browse All Candidates',
                desc: 'The Talent Pool lists every active candidate on the platform. Filter by experience, skills, location, or notice period. Search by name or keyword.',
                link: '/company/talent',
                linkLabel: 'Open Talent Pool →',
            },
            {
                n: 2,
                title: 'Match Against a Job',
                desc: 'Select one of your active job postings from the dropdown. The platform instantly computes a fit score (0–100%) for every candidate based on skill match, experience level, and seniority. Candidates are re-sorted with best fits at the top.',
            },
            {
                n: 3,
                title: 'Unlock a Candidate Resume',
                desc: 'Click "Unlock Resume" on any candidate card. Single/Pack credits deduct one credit and give you the original PDF resume immediately. Platinum candidates get a privacy-redacted resume; full details are shared only after a hire.',
            },
            {
                n: 4,
                title: 'Add to Hiring Pipeline',
                desc: 'After unlocking (Single/Pack), an "Add to Pipeline" button appears. This creates an application for the candidate on your selected job posting so they enter your hiring workflow.',
            },
        ],
    },
    {
        id: 'job-postings',
        icon: '💼',
        title: 'Job Postings',
        color: 'amber',
        steps: [
            {
                n: 1,
                title: 'Create a Job Posting',
                desc: 'Go to Job Postings → New Job. Fill in the title, description, location, experience range, salary range, and openings. The more detailed your description, the better the AI matching.',
                link: '/company/jobs',
                linkLabel: 'Go to Job Postings →',
            },
            {
                n: 2,
                title: 'AI Matching Runs Automatically',
                desc: 'As soon as you save a job, the platform extracts required and preferred skills from your description and computes fit scores for all existing applications. No action needed.',
            },
            {
                n: 3,
                title: 'View Applications',
                desc: 'Click any job to open its applications panel. Candidates are ranked highest fit-score first. You can see matched skills, missing skills, and experience level. Shortlist or reject candidates from here.',
            },
            {
                n: 4,
                title: 'Manage Job Status',
                desc: 'Use the status toggle to set a job as Active, Paused, or Closed. Only active jobs appear in candidate job searches and receive new applications.',
            },
        ],
    },
    {
        id: 'shortlist',
        icon: '⭐',
        title: 'Shortlisting Candidates',
        color: 'yellow',
        steps: [
            {
                n: 1,
                title: 'Shortlist from Applications',
                desc: 'Inside a job\'s application list, click the star icon or "Shortlist" button next to any candidate. You can add notes. Shortlisted candidates appear in your Shortlist tab.',
                link: '/company/shortlist',
                linkLabel: 'Go to Shortlist →',
            },
            {
                n: 2,
                title: 'Review Candidate Profiles',
                desc: 'Unlocked candidates show their full name, contact, resume, and skills. Locked candidates show masked information until you purchase an unlock.',
            },
            {
                n: 3,
                title: 'Move Status Along the Pipeline',
                desc: 'Update each application\'s status as hiring progresses: Under Review → Shortlisted → Interview Scheduled → Interviewed → Offer Sent. This keeps your pipeline organised.',
            },
        ],
    },
    {
        id: 'interviews',
        icon: '🗓',
        title: 'Scheduling Interviews',
        color: 'green',
        steps: [
            {
                n: 1,
                title: 'Submit an Interview Request',
                desc: 'From your Shortlist or Applications view, click "Request Interview" on a shortlisted candidate. Specify preferred date/time slots, mode (video/in-person/phone), and any notes.',
                link: '/company/interviews',
                linkLabel: 'Go to Interviews →',
            },
            {
                n: 2,
                title: 'Executive Review & Approval',
                desc: 'Your assigned LadderStep executive reviews the request. They may confirm the slot or coordinate with the candidate on your behalf. You\'ll get a notification once a slot is confirmed.',
            },
            {
                n: 3,
                title: 'Candidate Confirms',
                desc: 'The candidate receives an interview invitation and confirms or requests a reschedule. Once confirmed, the interview appears on your Interviews page with full details.',
            },
            {
                n: 4,
                title: 'Record the Outcome',
                desc: 'After the interview, mark the result (Selected / Rejected / On Hold) and add feedback. This is required before you can move forward with an offer.',
            },
        ],
    },
    {
        id: 'offers',
        icon: '📨',
        title: 'Making an Offer',
        color: 'blue',
        steps: [
            {
                n: 1,
                title: 'Submit an Offer Request',
                desc: 'After a successful interview, click "Submit Offer Request" on the candidate. Enter the annual CTC you\'re offering. This goes to your LadderStep executive for approval.',
                link: '/company/offers',
                linkLabel: 'Go to Offers →',
            },
            {
                n: 2,
                title: 'Executive Approval & Placement Fee',
                desc: 'The executive reviews the offer and approves it. A placement fee invoice is generated at this stage (Platinum companies only — Single/Pack hires have the fee waived). You\'ll see it in Payments.',
            },
            {
                n: 3,
                title: 'Generate the Offer Letter',
                desc: 'Once approved, an "Generate Offer Letter" button appears. This creates a formal offer letter. The candidate can then Accept or Decline.',
            },
            {
                n: 4,
                title: 'Candidate Accepts',
                desc: 'If the candidate accepts, their application moves to "Hired" and they are locked from other opportunities on the platform. The hiring process is complete.',
            },
        ],
    },
    {
        id: 'payments',
        icon: '💳',
        title: 'Payments & Billing',
        color: 'rose',
        steps: [
            {
                n: 1,
                title: 'Resume Packages',
                desc: 'Single (₹999 / 1 resume) and 4-Pack (₹3,999 / 4 resumes) are one-time purchases paid via Cashfree. Credits never expire and apply to any candidate on the platform.',
                link: '/company/payments',
                linkLabel: 'Go to Payments →',
            },
            {
                n: 2,
                title: 'Placement Fee Invoices',
                desc: 'Platinum companies are billed a placement fee when an offer is approved. The fee is calculated as: Annual CTC × your agreed placement fee %. You can pay in full or part from Payments.',
            },
            {
                n: 3,
                title: 'Training Invoices',
                desc: 'If you request corporate training, an invoice is raised after approval. Pay via the Payments page and our trainers will schedule the sessions.',
            },
            {
                n: 4,
                title: 'Invoice History',
                desc: 'All invoices — pending, paid, and overdue — appear in the Payments section. Download receipts or view payment status for each transaction.',
            },
        ],
    },
];

const FAQS = [
    {
        q: 'How long does account approval take?',
        a: 'Typically 1–2 business days. You\'ll receive an email once your account is approved. If you haven\'t heard back in 2 days, contact your LadderStep executive directly.',
    },
    {
        q: 'What is the difference between Single/Pack and Platinum?',
        a: 'Single and Pack are pre-paid credits — you pay per resume and no placement fee is charged at hire. Platinum gives you unlimited resume access (privacy-redacted) at no upfront cost, but a placement fee (% of CTC) applies when you hire a candidate.',
    },
    {
        q: 'Can I post jobs without a resume package?',
        a: 'Yes — you can post jobs and view application summaries. However, you cannot see full candidate profiles, resumes, or contact details until you have an active package.',
    },
    {
        q: 'Why can\'t I directly schedule an interview?',
        a: 'Interview slots are created by your LadderStep executive after reviewing your request. This ensures the candidate is still active and available before confirming the time with both parties.',
    },
    {
        q: 'What happens if a candidate declines the offer?',
        a: 'The application moves back to "Interviewed" status. You can submit a new offer request at a revised CTC, or close the application and move to the next candidate.',
    },
    {
        q: 'How is the AI fit score calculated?',
        a: 'The score (0–100%) considers: required skill coverage (55%), optional skills bonus (up to 10%), experience years vs the job\'s required range (20%), seniority level match (10%), and education (15%). The best-fit candidates always appear first in your application list.',
    },
];

export default function CompanyHelp() {
    const [openFaq, setOpenFaq] = useState(null);
    const [activeSection, setActiveSection] = useState(null);

    const colorMap = {
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'bg-indigo-100 text-indigo-700', num: 'bg-indigo-600 text-white', title: 'text-indigo-800' },
        violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-700', num: 'bg-violet-600 text-white', title: 'text-violet-800' },
        amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'bg-amber-100 text-amber-700',  num: 'bg-amber-600 text-white',  title: 'text-amber-800' },
        yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-700', num: 'bg-yellow-600 text-white', title: 'text-yellow-800' },
        green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'bg-green-100 text-green-700',  num: 'bg-green-600 text-white',  title: 'text-green-800' },
        blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'bg-blue-100 text-blue-700',   num: 'bg-blue-600 text-white',   title: 'text-blue-800' },
        rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'bg-rose-100 text-rose-700',   num: 'bg-rose-600 text-white',   title: 'text-rose-800' },
    };

    return (
        <div className="max-w-4xl mx-auto pb-16">
            {/* Hero */}
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-8 py-10 mb-10">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">📖</span>
                    <h1 className="text-2xl font-bold text-indigo-900">Company Portal Guide</h1>
                </div>
                <p className="text-indigo-500 text-sm leading-relaxed max-w-2xl">
                    Everything you need to post jobs, discover talent, schedule interviews, and make offers — all in one place. Follow the steps below or jump to any section.
                </p>
                {/* Quick nav */}
                <div className="flex flex-wrap gap-2 mt-6">
                    {SECTIONS.map(s => (
                        <a key={s.id} href={`#${s.id}`}
                            className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full px-3 py-1 transition">
                            {s.icon} {s.title}
                        </a>
                    ))}
                </div>
            </div>

            {/* Hiring workflow banner */}
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-10">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">End-to-End Hiring Flow</p>
                <div className="flex flex-wrap items-center gap-1 text-sm">
                    {['Post Job', 'Browse Talent', 'Unlock Resume', 'Shortlist', 'Request Interview', 'Exec Approves', 'Candidate Confirms', 'Submit Offer', 'Exec Approves', 'Offer Accepted ✓'].map((step, i, arr) => (
                        <span key={i} className="flex items-center gap-1">
                            <span className="bg-indigo-50 text-indigo-700 rounded-md px-2 py-0.5 font-medium text-xs whitespace-nowrap">{step}</span>
                            {i < arr.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                        </span>
                    ))}
                </div>
            </div>

            {/* Sections */}
            {SECTIONS.map(section => {
                const c = colorMap[section.color];
                const open = activeSection === section.id;
                return (
                    <div key={section.id} id={section.id} className="mb-6">
                        <button
                            onClick={() => setActiveSection(open ? null : section.id)}
                            className={`w-full flex items-center justify-between px-6 py-4 rounded-xl border-2 text-left transition-all ${
                                open ? `${c.bg} ${c.border}` : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ${c.icon}`}>
                                    {section.icon}
                                </span>
                                <span className={`text-base font-semibold ${open ? c.title : 'text-gray-800'}`}>
                                    {section.title}
                                </span>
                            </div>
                            <span className={`text-lg transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
                        </button>

                        {open && (
                            <div className={`border-2 border-t-0 ${c.border} rounded-b-xl px-6 pt-4 pb-6 ${c.bg}`}>
                                <div className="space-y-4">
                                    {section.steps.map(step => (
                                        <div key={step.n} className="flex gap-4">
                                            <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${c.num}`}>
                                                {step.n}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-gray-800 mb-1">{step.title}</p>
                                                <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                                                {step.link && (
                                                    <Link to={step.link}
                                                        className="inline-block mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                                                        {step.linkLabel}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* FAQ */}
            <div className="mt-10">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
                <div className="space-y-2">
                    {FAQS.map((faq, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                            >
                                <span>{faq.q}</span>
                                <span className={`text-gray-400 transition-transform shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}>⌄</span>
                            </button>
                            {openFaq === i && (
                                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Retake tour */}
            <div className="mt-8 bg-white border border-indigo-100 rounded-xl px-6 py-4 flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-gray-800">Take the portal tour again</p>
                    <p className="text-xs text-gray-400 mt-0.5">Walk through each section step by step with a guided spotlight.</p>
                </div>
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('company-tour-restart'))}
                    className="shrink-0 text-xs font-medium px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    ▶ Start Tour
                </button>
            </div>

            {/* Support footer */}
            <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl px-6 py-5 text-center">
                <p className="text-sm text-gray-700 font-medium mb-1">Still need help?</p>
                <p className="text-sm text-gray-500">Reach out to your assigned LadderStep executive or email us at <span className="text-indigo-600 font-medium">crm@theladderconsulting.com</span></p>
            </div>
        </div>
    );
}
