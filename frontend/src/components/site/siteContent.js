import {
    MapIcon, UserGroupIcon, ShieldCheckIcon, ArrowTrendingUpIcon,
    LightBulbIcon, BookOpenIcon, RocketLaunchIcon, HandRaisedIcon,
} from '@heroicons/react/24/outline';

// All copy for the public marketing website lives here, so it can be edited in one place.
// Structure and voice follow ladderstep-brand/ladderstep-brand-context.md (8 Oct 2026): the four pillars
// Strategize, Enable, Secure, Scale. The services listed under each pillar are the firm's existing
// Training, HR and Corporate Finance services, regrouped. Nothing here is a made-up number or client.

export const contactEmail = 'crm@theladderconsulting.com';

export const companyInfo = {
    name: 'Ladderstep Consulting',
    tagline: 'Strategize. Enable. Secure. Scale.',
    headline: 'Every step is a launch.',
    description: 'Ladderstep Consulting is a business consulting firm for Small & Medium Businesses. SMBs are the backbone of our economy, and we support them through every step of scaling up.',
    vision: 'To empower Indian businesses with better talent and better profits, inspired by the initiative of Viksit Bharat 2047',
};

// ── The four pillars ─────────────────────────────────────────────────────────────────────
// Each pillar has its own page at /services/<slug>. `promise` is the one-liner on the stepping cards.
// The fourth pillar's name ("Sustainable Growth") is assumed in the brand file and still to be confirmed.
export const pillars = [
    {
        slug: 'strategize',
        step: 1,
        word: 'Strategize',
        name: 'Strategy & Go-To-Market',
        icon: MapIcon,
        promise: 'Clarify the path before you climb.',
        title: 'Clarify the path before you climb',
        subtitle: 'Set your direction with a clear vision, shared values, an honest read of your people and a plan for how your growth will be funded.',
        intro: 'The foundation every next step stands on',
        items: [
            { title: 'Vision and value exercise', description: 'Define and align your organisation’s vision and core values.' },
            { title: 'HR surveys', description: 'Employee surveys that show where your people stand, so decisions start from facts.' },
            { title: 'Funding assessment', description: 'Evaluate your funding needs and identify the best financing options.' },
        ],
    },
    {
        slug: 'enable',
        step: 2,
        word: 'Enable',
        name: 'People & Capability',
        icon: UserGroupIcon,
        promise: 'Build the people who build the business.',
        title: 'Build the people who build the business',
        subtitle: 'Training for leaders, sales teams and everyone in between, and recruitment that brings the right talent in.',
        intro: 'Programs and hiring that grow your team’s capability',
        items: [
            { title: 'Executive training programs', description: 'Comprehensive programs designed for senior leadership and executives.' },
            { title: 'Leadership training', description: 'Build strong leadership capabilities and strategic thinking.' },
            { title: 'Selling skills training', description: 'Master the art of sales and client relationship management.' },
            { title: 'Soft skills training', description: 'Develop essential interpersonal and communication skills.' },
            { title: 'DiSC behavioural training', description: 'Understand behavioural styles and improve team dynamics.' },
            { title: 'Recruitment', description: 'End-to-end talent acquisition to find the right candidates, backed by our hiring platform.' },
        ],
    },
    {
        slug: 'secure',
        step: 3,
        word: 'Secure',
        name: 'Capital, Risk & Protection',
        icon: ShieldCheckIcon,
        promise: 'Fund the climb and protect what you build.',
        title: 'Fund the climb. Protect what you build.',
        subtitle: 'Business loans, insurance and cost reviews that give you financial and operational confidence.',
        intro: 'Capital, cover and cost control for a growing business',
        items: [
            { title: 'Business loans', description: 'Secured and unsecured business loans tailored to your requirements.' },
            { title: 'Business insurance', description: 'Insurance solutions that protect your business assets and lower operational risk.' },
            { title: 'Expense reduction consultation', description: 'Identify opportunities to optimise costs and improve profitability.' },
        ],
    },
    {
        slug: 'scale',
        step: 4,
        word: 'Scale',
        name: 'Systems, Compliance & Sustainable Growth',
        icon: ArrowTrendingUpIcon,
        promise: 'Put systems in place that let growth last.',
        title: 'Systems that let growth last',
        subtitle: 'HR playbooks, performance management and ESG consulting, so your business stays organised and responsible as it grows.',
        intro: 'The structure that turns growth into lasting growth',
        items: [
            { title: 'HR playbook creation', description: 'HR policies and procedures written for your business, so the way you work scales with you.' },
            { title: 'Performance management foundation', description: 'Establish robust performance management systems and processes.' },
            { title: 'ESG consultation', description: 'Environmental, Social and Governance consulting for sustainable business practices.' },
        ],
    },
];

export const pillarHref = (p) => `/services/${p.slug}`;

export const navigationLinks = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Services', href: '/services' },
    { label: 'Contact', href: '/contact' },
];

// The strip under the hero: plain facts about the firm, not made-up numbers.
export const glance = [
    { label: 'Built for', value: 'Small & Medium Businesses' },
    { label: 'Four pillars', value: 'Strategize, Enable, Secure, Scale' },
    { label: 'One platform', value: 'Hiring, from sourcing to offer' },
    { label: 'Our vision', value: 'Viksit Bharat 2047' },
];

// "How we work": the client journey from clarity to growth.
export const journey = [
    { title: 'Start with a conversation', description: 'Tell us where your business is today and where you want it to go.' },
    { title: 'Find the right step', description: 'We match what you need now to the pillar that will move you furthest.' },
    { title: 'Work alongside your team', description: 'Training, hiring, funding or systems, delivered with your people as partners.' },
    { title: 'Keep climbing', description: 'As the business grows, we help you plan and take the next step.' },
];

export const coreValues = [
    { title: 'Quality consciousness', description: 'We hold every service and deliverable to the highest standard.', icon: BookOpenIcon },
    { title: 'Knowledge driven', description: 'Our solutions are backed by deep expertise and continuous learning.', icon: LightBulbIcon },
    { title: 'Proactive approach', description: 'We anticipate challenges and solve them before they become problems.', icon: RocketLaunchIcon },
    { title: 'Collaboration', description: 'We work closely with our clients as partners in their growth journey.', icon: HandRaisedIcon },
];

// The meaning of the mark, used on the About page.
export const brandStory = [
    { title: 'The steps', text: 'A disciplined climb on a solid foundation: structure, clarity and the right people in place.' },
    { title: 'The take-off', text: 'The moment a business accelerates. The plane points up and to the right, the direction of growth.' },
];

// The Ladderstep portal, described by what it really does today.
export const platform = {
    company: {
        title: 'For companies',
        lead: 'Post a role and let our executives source candidates for it.',
        points: [
            'Candidates sourced and shortlisted for each job you post',
            'Interviews and offers coordinated in one place',
            'LAILA, our AI assistant, drafts job posts and ranks candidates by fit',
        ],
        register: '/register?role=company',
    },
    seeker: {
        title: 'For job seekers',
        lead: 'Build one profile and get matched to real openings.',
        points: [
            'A live fit score for every job, ranked for you',
            'Apply in a click, then confirm interviews and answer offers online',
            'Premium profiles are verified and listed first to every company',
        ],
        register: '/register?role=candidate',
    },
};

// Contact page "Client portal" cards.
export const portalAccess = [
    {
        title: 'Company',
        description: 'Post jobs, review candidates sourced for you, and manage interviews and offers.',
        login: '/login',
        register: '/register?role=company',
    },
    {
        title: 'Job seeker',
        description: 'View opportunities that match you and manage your profile and applications.',
        login: '/login',
        register: '/register?role=candidate',
    },
];
