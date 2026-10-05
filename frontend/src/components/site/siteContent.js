import {
    AcademicCapIcon, UserGroupIcon, BanknotesIcon,
    LightBulbIcon, BookOpenIcon, RocketLaunchIcon, HandRaisedIcon,
} from '@heroicons/react/24/outline';

// All copy for the public marketing website lives here, so it can be edited in one place.
// Everything below comes from the company's own information map or from what the portal really does.

export const contactEmail = 'crm@theladderconsulting.com';

export const navigationLinks = [
    { label: 'Home', href: '/' },
    { label: 'About Us', href: '/about' },
    { label: 'Training', href: '/training' },
    { label: 'HR Services', href: '/hr-services' },
    { label: 'Corporate Finance', href: '/corporate-finance' },
    { label: 'Contact Us', href: '/contact' },
];

export const companyInfo = {
    name: 'LadderStep Human Consulting',
    tagline: 'Empowering Indian businesses with better talent and better profits',
    description: 'Ladder Consulting is a customised Business Consulting firm for Small & Medium Businesses. We believe that SMBs are the backbone of our economy and it is important to support them in their scaling up journey.',
    vision: 'To empower Indian businesses with better talent and better profits inspired by the initiative of Viksit Bharat 2047',
};

export const heroPillars = ['Executive Training', 'Selling Skills', 'Talent Development'];

// The strip under the hero: plain facts about the firm, not made-up numbers.
export const glance = [
    { label: 'Built for', value: 'Small & Medium Businesses' },
    { label: 'Two pillars', value: 'People & Profits' },
    { label: 'Three service lines', value: 'Training, HR & Finance' },
    { label: 'Our vision', value: 'Viksit Bharat 2047' },
];

export const trainingServices = [
    { title: 'Executive training programs', description: 'Comprehensive programs designed for senior leadership and executives.' },
    { title: 'Soft skills training', description: 'Develop essential interpersonal and communication skills.' },
    { title: 'Leadership training', description: 'Build strong leadership capabilities and strategic thinking.' },
    { title: 'Selling skills training', description: 'Master the art of sales and client relationship management.' },
    { title: 'DiSC behavioural training', description: 'Understand behavioral styles and improve team dynamics.' },
];

export const hrServices = [
    { title: 'HR playbook creation', description: 'Develop comprehensive HR policies and procedures tailored to your business.' },
    { title: 'Vision and value exercise', description: 'Define and align your organizational vision and core values.' },
    { title: 'Recruitment', description: 'End-to-end talent acquisition services to find the right candidates.' },
    { title: 'Performance management foundation', description: 'Establish robust performance management systems and processes.' },
    { title: 'HR Surveys', description: 'Conduct employee surveys to gather insights and improve engagement.' },
    { title: 'ESG Consultation', description: 'Environmental, Social, and Governance consulting for sustainable business practices.' },
];

export const financeServices = [
    { title: 'Funding assessment', description: 'Evaluate your funding needs and identify the best financing options.' },
    { title: 'Business Loans', description: 'Secured and unsecured business loans tailored to your requirements.' },
    { title: 'Business insurance', description: 'Comprehensive insurance solutions to protect your business assets.' },
    { title: 'Expense reduction consultation', description: 'Identify opportunities to optimize costs and improve profitability.' },
];

export const mainServices = [
    {
        key: 'training',
        title: 'Training',
        description: 'Comprehensive training programs for executives, sales teams, and leadership development.',
        href: '/training',
        icon: AcademicCapIcon,
        items: trainingServices,
    },
    {
        key: 'hr',
        title: 'HR Services',
        description: 'Complete HR solutions from recruitment to performance management and ESG consultation.',
        href: '/hr-services',
        icon: UserGroupIcon,
        items: hrServices,
    },
    {
        key: 'finance',
        title: 'Corporate Finance',
        description: 'Funding solutions, business loans, insurance, and expense optimization services.',
        href: '/corporate-finance',
        icon: BanknotesIcon,
        items: financeServices,
    },
];

export const twoPillars = {
    people: {
        title: 'People',
        tagline: 'Attract. Train. Retain.',
        description: 'Connect with us to attract, train and retain right talent in your organisation with our services which include training, talent acquisition and performance management.',
        points: ['Talent acquisition', 'Training programs', 'Performance management'],
    },
    profits: {
        title: 'Profits',
        tagline: 'Fund. Protect. Optimise.',
        description: 'Enhance your profits by easy business loans, lesser operational risks and expenses optimisation.',
        points: ['Easy business loans', 'Lesser operational risks', 'Expense optimisation'],
    },
};

export const coreValues = [
    { title: 'Quality Consciousness', description: 'We maintain the highest standards in all our services and deliverables.', icon: BookOpenIcon },
    { title: 'Knowledge Driven', description: 'Our solutions are backed by deep expertise and continuous learning.', icon: LightBulbIcon },
    { title: 'Proactive Approach', description: 'We anticipate challenges and provide solutions before they become problems.', icon: RocketLaunchIcon },
    { title: 'Collaboration', description: 'We work closely with our clients as partners in their growth journey.', icon: HandRaisedIcon },
];

// The LadderStep portal, described by what it really does today.
export const platform = {
    company: {
        title: 'For Companies',
        lead: 'Post a role and let our executives source candidates for it.',
        points: [
            'Candidates sourced and shortlisted for each job you post',
            'Interviews and offers coordinated in one place',
            'An AI assistant to draft job posts and rank candidates by fit',
        ],
        register: '/register?role=company',
    },
    seeker: {
        title: 'For Job Seekers',
        lead: 'Build one profile and get matched to real openings.',
        points: [
            'A live fit score for every job, ranked for you',
            'Apply in a click, then confirm interviews and answer offers online',
            'Premium profiles are verified and listed first to every company',
        ],
        register: '/register?role=candidate',
    },
};

// Contact page "Client Portal Access" cards.
export const portalAccess = [
    {
        title: 'Company',
        description: 'Post jobs, review candidates sourced for you, and manage interviews and offers.',
        login: '/login',
        register: '/register?role=company',
    },
    {
        title: 'Job Seeker',
        description: 'View opportunities that match you and manage your profile and applications.',
        login: '/login',
        register: '/register?role=candidate',
    },
];
