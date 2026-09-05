import { useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
    {
        id: 'getting-started',
        icon: '🚀',
        title: 'Getting Started',
        color: 'blue',
        steps: [
            {
                n: 1,
                title: 'Complete Your Profile',
                desc: 'Go to My Profile and fill in your headline, summary, current location, expected salary, and notice period. A complete profile is shown to companies and improves your match score.',
                link: '/candidate/profile',
                linkLabel: 'Go to My Profile →',
            },
            {
                n: 2,
                title: 'Upload Your Resume',
                desc: 'In the My Profile page, scroll to the Resume section and upload your latest CV (PDF, DOC, or DOCX — max 5 MB). The system automatically extracts your skills and experience to power AI matching.',
            },
            {
                n: 3,
                title: 'Add Education & Experience',
                desc: 'Fill in your education history and work experience entries. This data is used for matching you with the right seniority-level roles — junior, senior, manager, and above.',
            },
        ],
    },
    {
        id: 'browse-jobs',
        icon: '💼',
        title: 'Browsing Jobs',
        color: 'indigo',
        steps: [
            {
                n: 1,
                title: 'View AI-Matched Jobs',
                desc: 'Go to Browse Jobs to see all active job postings. Jobs are ranked by your fit score — the closer the match to your skills and experience, the higher it appears.',
                link: '/candidate/jobs',
                linkLabel: 'Browse Jobs →',
            },
            {
                n: 2,
                title: 'Understand Your Fit Score',
                desc: 'Each job card shows a percentage fit score. This considers: skills you share with the job requirements, your years of experience vs the required range, your seniority level vs the job title, and your education.',
            },
            {
                n: 3,
                title: 'Read the Full Job Description',
                desc: 'Click any job card to see the full description, required and preferred skills, salary range, location, work mode, and openings. The matched and missing skills are highlighted.',
            },
            {
                n: 4,
                title: 'Filter & Search',
                desc: 'Use the search bar or filters to narrow by location, work mode (remote/hybrid/on-site), experience level, or salary range. Your fit scores update in real time as you browse.',
            },
        ],
    },
    {
        id: 'applying',
        icon: '📋',
        title: 'Applying to Jobs',
        color: 'violet',
        steps: [
            {
                n: 1,
                title: 'Apply from Browse Jobs',
                desc: 'Click "Apply" on any job card. The system attaches your latest uploaded resume automatically. You can optionally add a cover letter message.',
                link: '/candidate/jobs',
                linkLabel: 'Find Jobs to Apply →',
            },
            {
                n: 2,
                title: 'You May Also Be Sourced',
                desc: 'LadderStep executives actively source candidates for open roles. If sourced, an application appears in your Applications tab. You\'ll receive a notification when this happens.',
            },
            {
                n: 3,
                title: 'Track Your Applications',
                desc: 'Go to Applications to see every job you\'ve applied to and its current status: Under Review → Shortlisted → Interview Scheduled → Interviewed → Offer Sent.',
                link: '/candidate/applications',
                linkLabel: 'View Applications →',
            },
        ],
    },
    {
        id: 'interviews',
        icon: '🗓',
        title: 'Interview Process',
        color: 'green',
        steps: [
            {
                n: 1,
                title: 'Receive an Interview Invitation',
                desc: 'When a company requests an interview and the LadderStep executive approves it, you\'ll receive an email notification with the proposed slot details (date, time, mode, and location/link).',
                link: '/candidate/interviews',
                linkLabel: 'Go to Interviews →',
            },
            {
                n: 2,
                title: 'Confirm or Request Reschedule',
                desc: 'Open the interview from your Interviews page and click "Confirm Slot" to accept. If the time doesn\'t work, contact your LadderStep executive to arrange an alternate slot.',
            },
            {
                n: 3,
                title: 'Attend the Interview',
                desc: 'Join on the confirmed date/time. For video interviews, use the link provided. For in-person, the venue address is in the interview details.',
            },
            {
                n: 4,
                title: 'After the Interview',
                desc: 'The outcome (selected, rejected, or on hold) is recorded by the company. If selected, an offer will be made. You\'ll be notified of any update on your application status.',
            },
        ],
    },
    {
        id: 'offers',
        icon: '📨',
        title: 'Receiving an Offer',
        color: 'amber',
        steps: [
            {
                n: 1,
                title: 'Offer Notification',
                desc: 'If a company makes you an offer, you\'ll receive an email and in-app notification. The offer will appear on your Interviews page under the Offers tab.',
                link: '/candidate/interviews',
                linkLabel: 'View Offers →',
            },
            {
                n: 2,
                title: 'Review the Offer',
                desc: 'The offer letter shows the company name, role title, and annual CTC offered. Take time to review the details before responding.',
            },
            {
                n: 3,
                title: 'Accept or Decline',
                desc: 'Click "Accept Offer" to confirm. This marks your application as Hired and closes your profile to new offers from other companies on the platform. Click "Decline" if you choose not to proceed.',
            },
            {
                n: 4,
                title: 'After Accepting',
                desc: 'Your application status changes to Hired. Congratulations! The LadderStep team will follow up with onboarding information. You cannot apply to new jobs on this platform once hired.',
            },
        ],
    },
    {
        id: 'documents',
        icon: '📁',
        title: 'Documents',
        color: 'rose',
        steps: [
            {
                n: 1,
                title: 'Upload Supporting Documents',
                desc: 'Go to Documents to upload certificates, identity proof, experience letters, or any file the company or LadderStep may have requested. Max 10 MB per file.',
                link: '/candidate/documents',
                linkLabel: 'Go to Documents →',
            },
            {
                n: 2,
                title: 'Document Visibility',
                desc: 'Documents you upload are visible to LadderStep executives who manage your applications. They are not automatically shared with companies — sharing happens through the executive.',
            },
        ],
    },
];

const FAQS = [
    {
        q: 'How is my fit score calculated?',
        a: 'Your fit score (0–100%) is computed by comparing your skills, experience years, seniority level (based on your job headline), and education against the job\'s requirements. Upload a detailed resume and fill your profile completely for the best score.',
    },
    {
        q: 'Can I apply to multiple jobs at the same time?',
        a: 'Yes — you can apply to as many active jobs as you like. Each application is tracked independently. If you are hired for one role, your account is locked and you won\'t be able to apply to others.',
    },
    {
        q: 'Will companies see my contact details before unlocking?',
        a: 'No. Companies only see a masked version of your profile (name and contact redacted) unless they purchase a resume unlock. This protects your privacy until both sides are serious.',
    },
    {
        q: 'What happens if I am sourced for a job I didn\'t apply to?',
        a: 'A LadderStep executive has matched you to a role and created an application on your behalf. You\'ll receive a notification. The same interview and offer process applies — no extra action needed from your side to start.',
    },
    {
        q: 'How do I reschedule an interview?',
        a: 'You cannot reschedule directly from the app. Contact your LadderStep executive or email crm@theladderconsulting.com with your preferred alternate slots. The executive will coordinate with the company and update the slot.',
    },
    {
        q: 'Can I update my resume after applying to a job?',
        a: 'Yes — upload a new resume any time from My Profile. The new resume becomes your primary resume and is used for future applications. Existing applications retain the resume that was attached when you applied.',
    },
    {
        q: 'My profile looks incomplete. What should I fill in first?',
        a: 'Start with: (1) headline — your current or target role title, (2) resume upload, (3) total experience years, (4) skills list, (5) education. These five data points drive AI matching and are seen by recruiters first.',
    },
];

export default function CandidateHelp() {
    const [openFaq, setOpenFaq] = useState(null);
    const [activeSection, setActiveSection] = useState(null);

    const colorMap = {
        blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'bg-blue-100 text-blue-700',   num: 'bg-blue-600 text-white',   title: 'text-blue-800' },
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'bg-indigo-100 text-indigo-700', num: 'bg-indigo-600 text-white', title: 'text-indigo-800' },
        violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-700', num: 'bg-violet-600 text-white', title: 'text-violet-800' },
        green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'bg-green-100 text-green-700',  num: 'bg-green-600 text-white',  title: 'text-green-800' },
        amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'bg-amber-100 text-amber-700',  num: 'bg-amber-600 text-white',  title: 'text-amber-800' },
        rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'bg-rose-100 text-rose-700',   num: 'bg-rose-600 text-white',   title: 'text-rose-800' },
    };

    return (
        <div className="max-w-4xl mx-auto pb-16">
            {/* Hero */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-8 py-10 mb-10">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">📖</span>
                    <h1 className="text-2xl font-bold">Candidate Portal Guide</h1>
                </div>
                <p className="text-blue-100 text-sm leading-relaxed max-w-2xl">
                    Your step-by-step guide to building your profile, finding the right roles, and navigating the hiring process from application to offer.
                </p>
                <div className="flex flex-wrap gap-2 mt-6">
                    {SECTIONS.map(s => (
                        <a key={s.id} href={`#${s.id}`}
                            className="text-xs bg-white/20 hover:bg-white/30 text-white rounded-full px-3 py-1 transition">
                            {s.icon} {s.title}
                        </a>
                    ))}
                </div>
            </div>

            {/* Journey flow */}
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-10">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Journey on LadderStep</p>
                <div className="flex flex-wrap items-center gap-1 text-sm">
                    {['Build Profile', 'Upload Resume', 'Browse Jobs', 'Apply', 'Get Shortlisted', 'Confirm Interview', 'Attend Interview', 'Receive Offer', 'Accept & Get Hired ✓'].map((step, i, arr) => (
                        <span key={i} className="flex items-center gap-1">
                            <span className="bg-blue-50 text-blue-700 rounded-md px-2 py-0.5 font-medium text-xs whitespace-nowrap">{step}</span>
                            {i < arr.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                        </span>
                    ))}
                </div>
            </div>

            {/* Profile completeness tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 mb-8 flex gap-3">
                <span className="text-2xl shrink-0">💡</span>
                <div>
                    <p className="text-sm font-semibold text-amber-900">Tip: Complete profiles get matched first</p>
                    <p className="text-sm text-amber-800 mt-0.5">
                        Candidates with a headline, resume, experience years, and at least 5 skills listed get surfaced to companies and appear higher in search results.{' '}
                        <Link to="/candidate/profile" className="font-medium underline">Complete your profile →</Link>
                    </p>
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
                                                        className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">
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

            {/* Support */}
            <div className="mt-10 bg-blue-50 border border-blue-100 rounded-xl px-6 py-5 text-center">
                <p className="text-sm text-gray-700 font-medium mb-1">Need assistance?</p>
                <p className="text-sm text-gray-500">Contact us at <span className="text-blue-600 font-medium">crm@theladderconsulting.com</span> — our team typically responds within one business day.</p>
            </div>
        </div>
    );
}
