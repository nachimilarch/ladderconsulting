// All copy for the public marketing website lives here, so it can be edited in one place.

export const navigationLinks = [
    { label: 'Home', href: '/' },
    { label: 'About Us', href: '/about' },
    { label: 'Training', href: '/training' },
    { label: 'HR Services', href: '/hr-services' },
    { label: 'Corporate Finance', href: '/corporate-finance' },
    { label: 'Contact Us', href: '/contact' },
];

export const mainServices = [
    {
        title: 'Training',
        description: 'Comprehensive training programs for executives, sales teams, and leadership development.',
        href: '/training',
    },
    {
        title: 'HR Services',
        description: 'Complete HR solutions from recruitment to performance management and ESG consultation.',
        href: '/hr-services',
    },
    {
        title: 'Corporate Finance',
        description: 'Funding solutions, business loans, insurance, and expense optimization services.',
        href: '/corporate-finance',
    },
];

export const companyInfo = {
    name: 'LadderStep Human Consulting',
    tagline: 'Empowering Indian businesses with better talent and better profits',
    description: 'Ladder Consulting is a customised Business Consulting firm for Small & Medium Businesses. We believe that SMBs are the backbone of our economy and it is important to support them in their scaling up journey.',
    vision: 'To empower Indian businesses with better talent and better profits inspired by the initiative of Viksit Bharat 2047',
};

export const twoPillars = {
    people: {
        title: 'People',
        description: 'Connect with us to attract, train and retain right talent in your organisation with our services which include training, talent acquisition and performance management.',
    },
    profits: {
        title: 'Profits',
        description: 'Enhance your profits by easy business loans, lesser operational risks and expenses optimisation.',
    },
};

export const coreValues = [
    { title: 'Quality Consciousness', description: 'We maintain the highest standards in all our services and deliverables.' },
    { title: 'Knowledge Driven', description: 'Our solutions are backed by deep expertise and continuous learning.' },
    { title: 'Proactive Approach', description: 'We anticipate challenges and provide solutions before they become problems.' },
    { title: 'Collaboration', description: 'We work closely with our clients as partners in their growth journey.' },
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

// "Client Portal Access" on the Contact page — these hand visitors to the real portal.
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
