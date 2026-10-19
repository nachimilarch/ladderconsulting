import {
    MapIcon, UserGroupIcon, ShieldCheckIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

// All copy for the public marketing website lives here, so it can be edited in one place.
// Source: "LadderStep Consulting: Website Content" (12 Oct 2026), eight pages built around the
// 4 Pillars: Strategy, Talent, Protection and Growth.
//
// The [placeholders] in that document were filled from the client's "Content to Fill In" sheet (14 Oct 2026).
// Still open: the team bios and photos, the street address and the phone / WhatsApp number. Those are
// deliberately NOT shown until confirmed; fill the fields marked TODO below and they appear on their own.

// Confirmed by the client: the CRM mailbox is the public contact address.
export const contactEmail = 'crm@theladderconsulting.com';

export const companyInfo = {
    name: 'LadderStep Consulting',
    city: 'AltF, Begumpet, Hyderabad, Telangana',
    phone: '+91 91000 85297',
    phoneHref: 'tel:+919100085297',
    whatsappHref: 'https://wa.me/919100085297',
    short: 'Practical, affordable consulting for Indian MSMEs and startups across strategy, talent, protection and growth.',
};

// ── Enquiry topics ───────────────────────────────────────────────────────────────────────
// Every call-to-action on the site goes to /contact?topic=<key>. The contact form reads the key,
// shows what the visitor is enquiring about and pre-selects "I need help with".
export const enquiryTopics = {
    'health-check': { label: 'Book a Free Business Health Check', need: 'Not sure yet' },
    consultant: { label: 'Talk to a Consultant', need: 'Not sure yet' },
    call: { label: 'Book a Call', need: 'Not sure yet' },
    'training-proposal': { label: 'Request a Training Proposal', need: 'Strategy' },
    'strategy-session': { label: 'Book a Strategy Session', need: 'Strategy' },
    recruitment: { label: 'Talk to Our Recruitment Team', need: 'Talent' },
    'insurance-gap': { label: 'Get a Free Insurance Gap Review', need: 'Protection' },
    'esg-readiness': { label: 'Book an ESG Readiness Call', need: 'Protection' },
    'funding-eligibility': { label: 'Check Your Funding Eligibility', need: 'Growth' },
};
export const enquiryHref = (topic) => `/contact?topic=${topic}`;

export const needOptions = ['Strategy', 'Talent', 'Protection', 'Growth', 'Not sure yet'];
export const businessTypes = ['MSME', 'Startup'];

// ── The 4 Pillars ────────────────────────────────────────────────────────────────────────
// `lead` + `summary` are the cards on the Home page. The rest builds each pillar page:
//   features  → larger panels (title, text, bullets, closing line)
//   services  → cards
//   why       → short reasons
//   steps     → numbered process
// Client quotes, supplied by the client. The city is not given for any of them yet.
export const clientQuotes = [
    {
        quote: 'Hiring the right people for our company used to take weeks and a lot of our management’s time. LadderStep changed that. Their team understood our requirements, screened candidates thoroughly and sent us only people who were genuinely a good fit. We saved time, reduced our hiring costs and got the right talent on board.',
        name: 'Kritika Agarwal', designation: 'Managing Director', company: '2 Degree Clicon',
    },
    {
        quote: 'Our teams work across different sites and functions, so building trust and coordination is always a challenge. LadderStep designed a team building session that was practical and highly engaging. We saw better communication and cooperation among our people almost immediately. It was time well invested.',
        name: 'D V Subramanyam', designation: 'Manager, HR', company: 'Devansh',
    },
    {
        quote: 'LadderStep brought down our hiring costs significantly, and the quality of candidates was better than we’d ever got before.',
        name: 'Rakesh', designation: 'HR Manager', company: 'White Shield',
    },
    {
        // Home loan client (20 Oct 2026). Growth pillar.
        quote: 'I would like to express my sincere appreciation to Ladder Consulting for assisting me with my home loan process. The overall experience has been positive, and I appreciate the support and guidance provided throughout the process. The team has helped me with the necessary formalities and documentation, making the home loan process easier to understand. I am grateful for their assistance and professionalism in helping me move closer to achieving my dream of owning a home. Thank you, Ladder Consulting, for your support and service.',
        name: 'Narendra Kumar Pedada', designation: 'Sterilization Specialist', company: 'Johns Hopkins Aramco Healthcare', city: 'Saudi Arabia',
    },
];

export const pillars = [
    {
        slug: 'strategy',
        step: 1,
        word: 'Strategy',
        icon: MapIcon,
        lead: 'Sharpen how you sell and lead.',
        offerings: ['Go-to-Market Strategy', 'Referral Marketing', 'Sales and Negotiation Training', 'Behavioural and Soft Skills', 'Customised Training', 'Executive Coaching'],
        summary: 'Go-to-market strategy, referral marketing, sales and negotiation training, behavioural and soft skills programs, and executive coaching.',
        meta: {
            title: 'Go-to-Market, Sales Training & Executive Coaching',
            description: 'GTM strategy, referral marketing, sales and negotiation training, soft skills programs and executive coaching for growing businesses.',
        },
        headline: 'A clear plan to win customers, and a team that can deliver it.',
        intro: 'Most founders have a great product. What holds them back is getting it to the right customers and building a team that sells with confidence. Our Strategy pillar sharpens both your plan and your people.',
        servicesHeading: 'Services',
        services: [
            { title: 'Go-to-Market Strategy for Founders', text: 'Who exactly is your customer, how will you reach them, and what will make them choose you? We help you define your target segments, positioning, pricing, channels and launch roadmap, so every rupee of marketing works harder.' },
            { title: 'Referral Marketing Strategy', text: 'Your happy customers are your cheapest sales force. We design structured referral programs, incentives and tracking systems that turn word of mouth into a predictable lead pipeline.' },
            { title: 'Selling and Negotiation Skills Training', text: 'Hands-on workshops that help your team open conversations, handle objections, negotiate without discounting away margins and close with confidence. Built on real scenarios from your industry.' },
            { title: 'Behavioural and Soft Skills Training', text: 'Communication, teamwork, ownership, time management, customer handling and leadership. Practical sessions that change how people work, not just what they know.' },
            { title: 'Customised Training Programs', text: 'Every business is different. We study your goals and skill gaps, then design a program around them, from a single workshop to a full-year learning calendar.' },
            { title: 'Executive Coaching', text: 'One-on-one coaching for founders, business heads and high-potential managers. Build clarity, decision-making ability and leadership presence as your company grows.' },
        ],
        stepsHeading: 'How we work',
        steps: [
            { title: 'Discover', text: 'Understand your business, market and team.' },
            { title: 'Design', text: 'Build the strategy or program around your specific goals.' },
            { title: 'Deliver', text: 'Workshops, coaching and hands-on implementation support.' },
            { title: 'Measure', text: 'Track adoption and results, and refine.' },
        ],
        cta: {
            title: 'Ready to sell smarter?',
            primary: { label: 'Request a Training Proposal', topic: 'training-proposal' },
            secondary: { label: 'Book a Strategy Session', topic: 'strategy-session' },
        },
    },
    {
        slug: 'talent',
        step: 2,
        word: 'Talent',
        icon: UserGroupIcon,
        lead: 'Hire right, faster and for less.',
        offerings: ['Hiring portal', 'HR Policies', 'Onboarding', 'Exit Interviews'],
        summary: 'Our hiring portal combines human recruiters with an AI layer to fill entry-level and middle-management roles quickly. Plus HR policies, onboarding and exit interviews.',
        meta: {
            title: 'AI-Powered Hiring & HR Services for MSMEs',
            description: 'Hire entry-level and mid-management talent faster and at lower cost. Plus HR policies, onboarding and exit interviews.',
        },
        headline: 'The right people, hired faster and at a fraction of the cost.',
        intro: 'For a growing business, one wrong hire can cost months. One unfilled role can stall a project. Our Talent pillar makes hiring simple and affordable, and builds the HR foundation that helps good people stay.',
        features: [
            {
                kind: 'portal',
                eyebrow: 'Our hiring portal',
                title: 'AI speed, human judgement',
                // The route a requirement takes, in the document's own words.
                flow: [
                    { title: 'Post your requirement', text: 'In minutes.' },
                    { title: 'An AI recruiter', text: 'Screens and shortlists candidates at speed.' },
                    { title: 'Our human recruiters', text: 'Verify fit, attitude and intent.' },
                    { title: 'Your desk', text: 'Only pre-screened, interview-ready candidates.' },
                ],
                text: 'We built a hiring portal designed for MSMEs. Post your requirement in minutes. Behind the scenes, an AI recruiter screens and shortlists candidates at speed, while our experienced human recruiters verify fit, attitude and intent before anyone reaches your desk.',
                bullets: [
                    'Shortlists in 6 days, not weeks',
                    'Affordable pricing that fits MSME budgets: ₹3,999 per job requirement, or 8.33% on the Platinum plan',
                    'Only pre-screened, interview-ready candidates',
                    'Full visibility of progress on the portal',
                ],
                closing: { lead: 'Our speciality:', text: 'entry-level and middle-management hiring.' },
                roles: ['Supervisors', 'Engineers', 'Site staff', 'Sales executives', 'Accountants', 'Team leads', 'Plant managers'],
            },
        ],
        clientSuccess: {
            heading: 'Client success',
            text: 'Manufacturing and construction companies trust us to fill critical roles quickly.',
            items: [0, 2],
        },
        servicesHeading: 'HR services',
        services: [
            { title: 'HR Policies', text: 'Clear, compliant policy manuals covering leave, attendance, conduct, appraisal, POSH and more, written for your business size and sector.' },
            { title: 'Onboarding', text: 'Structured onboarding plans, documentation and induction programs that help new hires become productive from week one.' },
            { title: 'Exit Interviews', text: 'Independent, confidential exit interviews that reveal the real reasons people leave, with insights to reduce attrition.' },
        ],
        cta: {
            title: 'Have a position to fill?',
            // The hiring portal is the real product: companies register there and post a requirement.
            primary: { label: 'Post a Hiring Requirement', to: '/register?role=company' },
            secondary: { label: 'Talk to Our Recruitment Team', topic: 'recruitment' },
        },
    },
    {
        slug: 'protection',
        step: 3,
        word: 'Protection',
        icon: ShieldCheckIcon,
        lead: 'Safeguard what you have built.',
        offerings: ['HR Compliance Consulting', 'ESG Reporting and Consulting', 'Corporate Insurance', 'Closing the insurance gap'],
        summary: 'HR compliance, GRI-standard ESG reporting, and engineering and construction insurance, with simple tools to spot and close gaps in your cover.',
        meta: {
            title: 'HR Compliance, ESG Reporting & Corporate Insurance',
            description: 'GRI-certified ESG reports, labour law compliance, and engineering and construction insurance for manufacturers and builders.',
        },
        headline: 'Protect your business, your people and your reputation.',
        intro: 'Growth brings new risks: labour law penalties, sustainability demands from large buyers, and project losses that can wipe out years of profit. Our Protection pillar keeps you compliant, credible and covered.',
        features: [
            {
                kind: 'compliance',
                title: 'HR Compliance Consulting',
                text: 'Indian labour laws are complex and changing, with the new Labour Codes adding to the load. We audit your current practices, identify gaps and help you set up the registers, returns, policies and processes needed to stay compliant, covering:',
                checklist: ['PF', 'ESI', 'Gratuity', 'Minimum wages', 'POSH', 'Shops and establishments', 'Factory regulations'],
            },
            {
                kind: 'esg',
                title: 'ESG Reporting and Consulting',
                text: 'Large customers, lenders and investors increasingly ask suppliers for ESG disclosures. Our GRI-certified reporters prepare credible sustainability reports for manufacturing and construction companies.',
                bullets: [
                    'ESG readiness assessment and materiality analysis',
                    'Data collection frameworks for energy, emissions, water, waste and social metrics',
                    'GHG emissions measurement',
                    'GRI-aligned sustainability reports',
                    'Support with buyer questionnaires, certifications and green finance requirements',
                ],
                closing: { lead: 'The result:', text: 'stronger standing with B2B buyers, better access to green finance and a clear roadmap to improve.' },
            },
            {
                kind: 'insurance',
                title: 'Corporate Insurance',
                text: 'We specialise in the covers that matter most to manufacturers and builders:',
                bullets: [
                    { lead: 'Engineering insurance', text: 'machinery breakdown, boiler and pressure plant, electronic equipment, contractor’s plant and machinery' },
                    { lead: 'Construction insurance', text: 'contractor’s all risk (CAR), erection all risk (EAR), project and third-party liability' },
                    'Fire, property and business interruption covers',
                    'Group health and employee benefit covers',
                ],
            },
            {
                kind: 'gap',
                title: 'Closing the insurance gap',
                // The client confirmed the gap review is done manually for now, so no tool is named.
                text: 'Many MSME owners discover they are under-insured only when a claim is made. Our innovative tools and simple, jargon-free approach help you understand exactly what your current policies cover, where the gaps are and how to close them cost-effectively.',
            },
        ],
        cta: {
            title: 'Is your business fully protected?',
            primary: { label: 'Get a Free Insurance Gap Review', topic: 'insurance-gap' },
            secondary: { label: 'Book an ESG Readiness Call', topic: 'esg-readiness' },
        },
    },
    {
        slug: 'growth',
        step: 4,
        word: 'Growth',
        icon: ArrowTrendingUpIcon,
        lead: 'Fund your next stage of scale.',
        offerings: ['Unsecured Business Loans', 'Secured Mortgage Loans', 'Short-Term Financing'],
        summary: 'Unsecured business loans, secured mortgage loans and short-term financing, structured around your cash flow.',
        meta: {
            title: 'Business Loans & Short-Term Financing for MSMEs',
            description: 'Unsecured business loans, mortgage loans and short-term finance, matched to your cash flow. Check your eligibility today.',
        },
        headline: 'The right capital, at the right time, on the right terms.',
        intro: 'A new order, a bigger plant, a working-capital crunch: growth almost always needs funding. But for MSMEs, getting a loan can mean weeks of paperwork, rejections and confusing terms. Our Growth pillar makes raising capital faster and simpler.',
        servicesHeading: 'Funding solutions',
        services: [
            { title: 'Unsecured Business Loans', text: 'Collateral-free funding for working capital, inventory, marketing or expansion, based on your business performance.' },
            { title: 'Secured Mortgage Loans', text: 'Loan against property for larger, longer-term needs at more competitive interest rates.' },
            { title: 'Short-Term Financing', text: 'Quick funding to bridge cash-flow gaps, fund a large order or manage seasonal demand.' },
            { title: 'Other funding options', text: 'Invoice discounting, equipment finance and overdraft facilities, matched to what your business needs.' },
        ],
        whyHeading: 'Why raise capital through LadderStep',
        why: [
            { title: 'Funding readiness review', text: 'We assess your financials and documents before you apply, so you approach lenders in the strongest position.' },
            { title: 'Access to multiple lenders', text: 'Banks, NBFCs and other lenders, so you compare options instead of taking the first offer.' },
            { title: 'Structured to your cash flow', text: 'Repayments that match how your business earns.' },
            { title: 'End-to-end support', text: 'From documentation to disbursement, we stay with you.' },
        ],
        stepsHeading: 'How it works',
        steps: [
            { title: 'Share', text: 'Share your requirement and basic financials.' },
            { title: 'Match', text: 'We assess eligibility and recommend the best-fit options.' },
            { title: 'Apply', text: 'We prepare and submit your application.' },
            { title: 'Grow', text: 'You receive funds and get back to growing.' },
        ],
        cta: {
            title: 'Ready to scale up?',
            primary: { label: 'Check Your Funding Eligibility', topic: 'funding-eligibility' },
        },
    },
];

export const pillarHref = (p) => `/${p.slug}`;

// The document's four "reusable CTA blocks". The floating call-to-action uses the one that fits the page.
export const ctaBlocks = {
    general: { text: 'One partner for strategy, talent, protection and growth.', label: 'Book a Free Business Health Check', topic: 'health-check' },
    hiring: { text: 'Stop losing weeks to hiring.', label: 'Post Your Requirement', to: '/register?role=company' },
    insurance: { text: 'Find out what your policy really covers.', label: 'Get a Free Gap Review', topic: 'insurance-gap' },
    funding: { text: 'See how much you could raise.', label: 'Check Eligibility', topic: 'funding-eligibility' },
};

// ── Navigation ───────────────────────────────────────────────────────────────────────────
export const navigationLinks = [
    { label: 'Home', href: '/' },
    { label: 'About Us', href: '/about' },
    { label: '4 Pillars', menu: true },
    { label: 'Who We Work With', href: '/who-we-work-with' },
    { label: 'Contact', href: '/contact' },
];

// ── Home ─────────────────────────────────────────────────────────────────────────────────
export const home = {
    meta: {
        title: 'LadderStep Consulting | MSME & Startup Consultants, Hyderabad',
        description: 'Strategy, hiring, HR compliance, ESG, insurance and business loans for Indian MSMEs and startups. One partner for every step of growth.',
    },
    hero: {
        eyebrow: 'LadderStep Consulting',
        headline: 'Build your business one strong step at a time.',
        sub: 'LadderStep Consulting helps Indian MSMEs and startups grow with clarity. We work across four pillars (Strategy, Talent, Protection and Growth) so founders get one trusted partner instead of five scattered vendors.',
        primary: { label: 'Book a Free Business Health Check', topic: 'health-check' },
        secondary: { label: 'Explore the 4 Pillars', href: '#pillars' },
    },
    intro: {
        heading: 'Running an MSME or startup means wearing every hat.',
        // The hats named in the first paragraph, each tied to the pillar that covers it.
        hats: [
            { label: 'selling', pillar: 'strategy' },
            { label: 'hiring', pillar: 'talent' },
            { label: 'staying compliant', pillar: 'protection' },
            { label: 'managing risk', pillar: 'protection' },
            { label: 'finding money to grow', pillar: 'growth' },
        ],
        paragraphs: [
            'You are selling, hiring, staying compliant, managing risk and finding money to grow, often in the same week.',
            'LadderStep brings practical, affordable expertise to each of these areas. We understand the realities of Indian businesses: tight budgets, lean teams and the need for results, not reports.',
        ],
    },
    pillarsHeading: { title: 'The 4 Pillars', sub: 'Every business climbs on four rungs. We help you strengthen each one.' },
    why: {
        heading: 'Why LadderStep',
        items: [
            { title: 'One partner, four pillars.', text: 'Strategy, talent, protection and growth work together. We see the full picture.' },
            { title: 'Built for MSMEs.', text: 'Pricing, timelines and solutions sized for growing Indian businesses.' },
            { title: 'Proven in manufacturing and construction.', text: 'Deep experience in sectors where hiring, safety and compliance matter most.' },
            { title: 'Tech plus human touch.', text: 'AI speeds up the work; experienced consultants make the judgement calls.' },
            { title: 'Certified expertise.', text: 'GRI-certified ESG reporters and specialists in engineering insurance.' },
        ],
    },
    testimonials: clientQuotes,
    results: [
        { value: '1500+', label: 'positions filled' },
        { value: '25%', label: 'average reduction in hiring cost' },
        { value: '6 days', label: 'average time to hire' },
        { value: '500+', label: 'MSMEs served' },
    ],
    closing: {
        title: 'Not sure where to start?',
        text: 'Book a free 30-minute Business Health Check. We will review your business across all four pillars and show you the one step that will make the biggest difference right now.',
        button: 'Book My Free Health Check',
    },
};

// ── About Us ─────────────────────────────────────────────────────────────────────────────
export const about = {
    meta: {
        title: 'About LadderStep Consulting | The 4 Pillars Approach',
        description: 'Practical, affordable consulting for Indian MSMEs and startups across strategy, talent, protection and growth.',
    },
    headline: 'Practical consulting for the businesses that build India.',
    lead: 'MSMEs and startups are the backbone of the Indian economy. Yet most consulting is designed for large corporates: priced high, slow to deliver and hard to apply on the shop floor.',
    approach: {
        heading: 'Our approach: the 4 Pillars',
        intro: 'We believe sustainable growth rests on four connected pillars.',
        // One line per rung: hover or tap a rung to read it.
        rungs: {
            strategy: 'A great strategy fails without the right talent.',
            talent: 'A great strategy fails without the right talent.',
            protection: 'Fast growth is fragile without protection.',
            growth: 'And none of it scales without capital.',
        },
        outro: 'That is why we look at your business as a whole, then work on the rung that needs attention first.',
    },
    beliefsHeading: 'What we believe',
    beliefs: [
        { title: 'Results over reports.', text: 'Every engagement ends with actions you can take on Monday.' },
        { title: 'Right-sized solutions.', text: 'Big-company thinking at MSME-friendly cost.' },
        { title: 'Long-term partnership.', text: 'We grow when our clients grow.' },
        { title: 'Honest advice.', text: 'If something is not right for your business, we will tell you.' },
    ],
    team: {
        heading: 'Our team',
        text: 'Our team includes GRI-certified ESG reporters, experienced recruiters, insurance specialists, corporate trainers and finance advisors.',
        directorsHeading: 'Meet Our Directors',
        directorsText: 'Five Directors with decades of experience between them, and close to every client.',
        groupPhoto: { src: '/site/team/group.webp', alt: 'The LadderStep team standing together in the office, with Mahua Gorthi seated in front.', caption: 'The LadderStep team' },
        // Bios supplied by the client (15 Oct 2026), lightly edited for the web. Nachiketh's was drafted from facts he
        // has shared; his title and the Strategy pillar are as he confirmed. `pillar` picks the colour and the chip.
        members: [
            {
                name: 'Venu Gorthi', title: 'Managing Director', pillar: 'protection', photo: '/site/team/venu.webp',
                thumb: '/site/team/venu-thumb.webp', facts: [{ value: '28', label: 'years in insurance sales' }, { value: 'MBA', label: 'and certified referral marketing coach' }],
                alt: 'Venu Gorthi, seated in an armchair, in a dark blazer and red tie.',
                bio: 'Venu has 28 years in insurance sales, including a role as Vice President – Agency Sales at HDFC Life Insurance, where he led large teams to sales and operational excellence. He holds an MBA and is a certified referral marketing coach. He pairs deep insurance expertise with an understanding of how businesses grow through trust and relationships. Empathetic and patient, he takes the time to understand each MSME owner’s risks and helps build protection that fits. His energy and motivation inspire clients and teams alike.',
            },
            {
                name: 'Mahua Gorthi', title: 'Director – Human Capital and Sustainability', pillar: 'talent', photo: '/site/team/mahua.webp',
                thumb: '/site/team/mahua-thumb.webp', facts: [{ value: '14', label: 'years in sales' }, { value: '14', label: 'years as an entrepreneur' }, { value: '3', label: 'startups founded' }],
                alt: 'Mahua Gorthi, standing with her arms crossed, in a dark blazer.',
                bio: 'Mahua brings 14 years of sales experience across pharma and insurance and 14 years as an entrepreneur, having founded three startups including LadderStep. She is a GRI-certified reporter, an NLP life coach and a certified business coach, and received the Best Business Coach award from Vyaapar Jagat. A master networker across several business platforms, she is known for logical thinking and clear communication. A recent breast cancer survivor, she embodies resilience and brings that strength to every founder she works with.',
            },
            {
                name: 'Surya Shailendra Kumar', title: 'Director – Client Success and Growth', pillar: 'growth', photo: '/site/team/surya.webp',
                thumb: '/site/team/surya-thumb.webp', facts: [{ value: '33', label: 'years in media and digital' }, { value: 'Level 1', label: 'cricket coach' }],
                alt: 'Surya Shailendra Kumar, smiling with his arms crossed, in a dark suit and red tie.',
                bio: 'Surya has 33 years of experience in media and digital, specialising in client success for real estate businesses. At The Hindu he served as Regional Manager and Vertical Head and earned reward trips across the world. He holds an MBA and is relationship-oriented: he connects with people easily, nurtures bonds for life and always goes the extra mile. An avid cricketer and Level 1 coach, he represented Hyderabad at zonal level.',
            },
            {
                name: 'Nachiketh Desai', title: 'Director – Technology', leads: 'Leads our technology arm', photo: '/site/team/nachiketh.webp',
                thumb: '/site/team/nachiketh-thumb.webp', facts: [{ value: 'B.Tech', label: 'Electronics and Communication, SRM University' }, { value: 'MBA', label: 'Entrepreneurship' }],
                alt: 'Nachiketh Desai, standing with his arms crossed, in a teal blazer and glasses.',
                bio: 'Nachiketh is the youngest member of the team, an entrepreneur and software engineer. He holds a B.Tech in Electronics and Communication Engineering from SRM University, Chennai, and an MBA in Entrepreneurship. He works hands-on across web applications, backend services and cloud infrastructure, and has built and run products end to end, from the first line of code to deployment and maintenance. He built the LadderStep portal and website. Practical and hands-on, he brings a builder’s approach to strategy: clear plans, systems that work and a close eye on what moves a business forward.',
            },
            {
                // Bio supplied by the client (16 Oct 2026). Photo: the client's own portrait.
                name: 'Sudheer Sivapuram', title: 'Director – Strategy and Expansion', pillar: 'strategy', photo: '/site/team/sudheer.webp', thumb: '/site/team/sudheer-thumb.webp',
                alt: 'Sudheer Sivapuram, smiling, in a light grey blazer and striped tie.',
                facts: [{ value: '33+', label: 'years of corporate experience' }, { value: '2', label: 'product acquisitions, from due diligence to integration' }],
                bio: 'Sudheer brings over 33 years of corporate experience across leadership roles in product marketing, business strategy and go-to-market initiatives. Having worked with customers across global markets, he has a strong understanding of diverse business environments and growth opportunities. His expertise spans brand positioning, ideal customer profiling, competitive analysis, messaging and integrated online and offline marketing strategies. He also brings deep insight into how organisations can use AI effectively to accelerate growth and improve business outcomes. Having played key roles in two product acquisitions, including due diligence and post-acquisition integration, Sudheer combines strategic thinking with practical execution to help businesses navigate growth and expansion.',
            },
        ],
    },
    cta: { title: 'Let’s talk about your next step.', button: 'Talk to a Consultant', topic: 'consultant' },
};

// ── Who We Work With ─────────────────────────────────────────────────────────────────────
export const whoWeWorkWith = {
    meta: {
        title: 'Consulting for Manufacturing, Construction & Startups',
        description: 'How LadderStep helps MSMEs and startups in manufacturing, construction, trading and services grow with confidence.',
    },
    headline: 'Built for the businesses that are building India.',
    segments: [
        { title: 'MSMEs', text: 'Established businesses ready for the next level, whether that means professionalising HR, entering new markets, meeting buyer ESG demands or funding a new plant. We bring structure without bureaucracy.' },
        { title: 'Startups', text: 'Founders moving from idea to traction. We help you nail your go-to-market, hire your first team, put basic compliance in place and access funding to scale.' },
    ],
    industriesHeading: 'Industries we know best',
    industries: [
        { name: 'Manufacturing', help: 'Shop-floor and supervisor hiring, labour compliance, ESG reports for B2B buyers, machinery and plant insurance' },
        { name: 'Construction and infrastructure', help: 'Site engineer and project hiring, CAR/EAR insurance, ESG reporting, project financing' },
        { name: 'Trading and distribution', help: 'Sales training, referral programs, working-capital loans' },
        { name: 'Services and technology startups', help: 'Go-to-market strategy, early hiring, HR policies, founder coaching' },
    ],
    cta: { title: 'See yourself here?', button: 'Book a Call', topic: 'call' },
};

// ── Contact ──────────────────────────────────────────────────────────────────────────────
export const contact = {
    meta: {
        title: 'Contact LadderStep Consulting | Hyderabad',
        description: 'Talk to a consultant about strategy, hiring, compliance, insurance or funding. We respond within one working day.',
    },
    headline: 'Let’s find your next step.',
    lead: 'Tell us a little about your business and what you need. A consultant will get back to you within one working day.',
    // The client gave the building and area ("AltF, Begumpet"); add the street and PIN code when available.
    details: {
        name: 'LadderStep Consulting',
        location: 'AltF, Begumpet, Hyderabad, Telangana',
        place: 'AltF, Begumpet',
        region: 'Hyderabad, Telangana',
        mapsHref: 'https://maps.app.goo.gl/HhGcVxsTLYthprQa9',
        phone: '+91 91000 85297',
        phoneHref: 'tel:+919100085297',
        whatsappHref: 'https://wa.me/919100085297',
        hours: ['Mon to Fri, 10 am to 6 pm', 'Saturday, 10 am to 2 pm'],
    },
    faqsHeading: 'Frequently asked questions',
    faqs: [
        { q: 'Do I need to take services from all four pillars?', a: 'No. Most clients start with one urgent need: a key hire, a loan or an insurance review. Because we understand the whole business, we can help with the other pillars when the time is right.' },
        { q: 'How is LadderStep different from a recruitment agency?', a: 'Our hiring portal pairs AI screening with human recruiters, so you get speed and quality at an MSME-friendly cost. And we can also set up the HR policies, onboarding and compliance that help new hires succeed.' },
        { q: 'What levels of roles do you hire for?', a: 'We specialise in entry-level and middle-management roles, especially in manufacturing and construction.' },
        { q: 'Who prepares your ESG reports?', a: 'Our reports are prepared by GRI-certified reporters with experience in manufacturing and construction.' },
        { q: 'My business already has insurance. Why should I talk to you?', a: 'Many policies leave gaps that only show up at claim time. A free gap review tells you what you are actually covered for and where you are exposed.' },
        { q: 'What types of loans can you help with?', a: 'Unsecured business loans, secured mortgage loans and short-term financing. We assess your eligibility first, then match you with suitable lenders.' },
        { q: 'Can you design training for our specific team?', a: 'Yes. All our training can be customised to your industry, team level and business goals.' },
        { q: 'Where are you located?', a: 'We are based in Hyderabad.' },
    ],
};

// Legal pages (these already exist in the portal).
export const legalLinks = [
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Terms of Service', href: '/terms-of-service' },
    { label: 'Refund & Cancellation', href: '/refund-and-cancellation' },
];
