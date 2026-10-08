import { Link } from 'react-router-dom';
import LegalLayout, { DefList, H3, Mail, P, UL } from './LegalLayout';
import { COMPANY } from './legalInfo';

const sections = [
    {
        id: 'about',
        title: 'About these terms',
        body: (
            <>
                <P>
                    These terms are an agreement between you and {COMPANY.legalName} ("LadderStep", "we", "us"), a company incorporated in India with its
                    registered office in {COMPANY.state}. They apply when you create an account on, sign in to, or otherwise use the {COMPANY.brandName} platform
                    at {COMPANY.site} (the "Platform").
                </P>
                <P>
                    By signing in or creating an account you confirm that you have read and accept these terms, our{' '}
                    <Link to="/privacy-policy" className="link">Privacy Policy</Link> and our{' '}
                    <Link to="/refund-and-cancellation" className="link">Refund &amp; Cancellation Policy</Link>. If you use the Platform for a
                    company, you confirm you are authorised to bind that company, and "you" includes the company. If you do not agree, please do not use the Platform.
                </P>
                <P>You must be at least 18 years old and able to enter a binding contract under Indian law.</P>
            </>
        ),
    },
    {
        id: 'what-we-do',
        title: 'What the Platform is',
        body: (
            <>
                <P>
                    The Platform is a recruitment and HR service. Companies post jobs and review candidates. Candidates build a profile, find jobs and apply. Our
                    recruitment executives help by sourcing candidates, arranging interviews and coordinating offers.
                </P>
                <UL items={[
                    'We connect companies and candidates. We are not the employer, and any employment is a contract between the company and the candidate.',
                    'We do not guarantee that a company will find a suitable candidate, that a candidate will be shortlisted, interviewed or hired, or that any offer will be made or accepted.',
                    'Match scores and AI suggestions are aids, not guarantees. Decisions about shortlisting, interviewing and hiring are made by people.',
                    'Except for the checks described for Premium candidates, we do not independently verify what candidates or companies tell us. Please do your own checks before relying on it.',
                ]} />
            </>
        ),
    },
    {
        id: 'accounts',
        title: 'Your account',
        body: (
            <UL items={[
                'Candidates and companies sign in with Google. Our staff sign in with Microsoft. You are responsible for the security of that account and for everything done through it.',
                'Give us accurate, current information and keep it up to date. Do not share your account, impersonate anyone, or create accounts using false details.',
                'We may ask companies for documents that confirm who they are and that the business is genuine, and we may suspend or remove a company we are not satisfied with.',
                'Tell us at once if you think someone else has used your account.',
                'We may suspend or close an account that breaks these terms, puts others at risk, or where we are required to by law.',
            ]} />
        ),
    },
    {
        id: 'candidates',
        title: 'Terms for candidates',
        body: (
            <>
                <UL items={[
                    'Applying for jobs and using the core Platform is free. You will not be asked to pay us in order to be considered for a job, and you should tell us if anyone claiming to act for us asks you to.',
                    'What you put in your profile, resume and documents must be true and your own. Fake or altered documents, including payslips, lead to suspension, loss of Premium, and, where relevant, may be reported.',
                    'You allow us to share your profile, contact details and resume with a company when you apply to its job or one of our executives puts you forward for it. Companies see your name, email address and phone number. See our Privacy Policy for the detail.',
                    'Candidate records may also be created by our executives from a resume given to us. You can ask to see, correct or delete such a record at any time.',
                    'If you accept a job through the Platform, your account is locked and you can no longer apply to other roles through it.',
                    'You decide whether to attend interviews and accept offers. If you cannot attend an interview, please tell us as early as you can.',
                ]} />

                <H3>Optional paid services for candidates</H3>
                <DefList rows={[
                    ['Premium (one-time fee)', 'For candidates whose current annual CTC is at least ₹6 lakh. We review your payslips and, if approved, you pay a one-time fee to become Premium. Premium candidates are shown with a badge and listed first to companies. It does not guarantee interviews or offers.'],
                    ['LAILA (monthly subscription)', 'An AI assistant that can polish your profile, find matching jobs and prepare applications for you to confirm. It renews monthly until you cancel.'],
                ]} />
                <P>
                    Prices are shown in the Platform before you pay. Refunds and cancellation are covered in the{' '}
                    <Link to="/refund-and-cancellation" className="link">Refund &amp; Cancellation Policy</Link>.
                </P>
            </>
        ),
    },
    {
        id: 'companies',
        title: 'Terms for companies',
        body: (
            <>
                <UL items={[
                    'Job postings must be genuine, lawful and accurate, describing a real vacancy that you are able to fill. They must not discriminate or ask candidates for money.',
                    'Use candidate information only to assess and hire for the role it was shared for. Keep it confidential, protect it, do not sell, publish or pass it on, do not use it for unrelated marketing, and delete it when you no longer need it. You must follow data protection law in how you handle it.',
                    'Do not contact candidates in a way that harasses them, and do not misuse the contact details you see.',
                    'Interviews and offers go through the Platform, with our executives, as set out in the Platform. Offer letters are released after our executive approves the request.',
                    'Do not avoid our fees by taking a hire that we introduced outside the Platform.',
                ]} />

                <H3>Fees for companies</H3>
                <DefList rows={[
                    ['Job posting fee', 'Companies on the standard plan pay a fee for each job they publish (currently ₹3,999 per job). The job goes live once payment is received. Companies on the Platinum plan do not pay this fee.'],
                    ['Placement fee', 'Payable when a candidate we introduce is hired. It is calculated on the candidate\'s offered annual CTC, at the rate in your agreement with us or, if there is none, the standard rate shown to you before you request the offer letter. It is invoiced when the offer letter is approved.'],
                    ['LAILA subscription', 'Optional AI assistant for drafting job posts and finding candidates, billed monthly until cancelled.'],
                    ['Training services', 'Optional training for your employees, priced and invoiced when we approve your request.'],
                ]} />
                <P>
                    Where your agreement with us says something different from these terms about fees, replacement of candidates or exclusivity, the agreement
                    applies.
                </P>
            </>
        ),
    },
    {
        id: 'payments',
        title: 'Payments',
        body: (
            <UL items={[
                'All prices are in Indian Rupees. GST and other applicable taxes are added where they apply and are shown on your invoice, for example GST at 18% on placement fees.',
                'Online payments are processed by Cashfree Payments. You agree to their terms when you pay. We do not store your card or bank details.',
                'Placement fee invoices are due within 14 days of being raised, and can be paid in part. We may pause access to hiring features while an invoice is overdue.',
                'Subscriptions renew each month by a new invoice that you pay. If a renewal is not paid on time, access continues for a short grace period and is then suspended until it is paid.',
                'If you believe an invoice or charge is wrong, tell us promptly so we can look into it before it is paid or becomes overdue.',
            ]} />
        ),
    },
    {
        id: 'ai',
        title: 'LAILA and other AI features',
        body: (
            <UL items={[
                'AI can produce wrong, incomplete or unsuitable output. Check what it writes before you rely on it, publish it or send it.',
                'LAILA only acts after you confirm a preview. You are responsible for what you confirm.',
                'Do not enter information in the chat that you do not want us to hold, such as passwords or payment details.',
                'AI features can be slow or unavailable, and we may change or remove them.',
            ]} />
        ),
    },
    {
        id: 'acceptable-use',
        title: 'Acceptable use',
        body: (
            <>
                <P>You agree not to:</P>
                <UL items={[
                    'break the law, or post content that is false, defamatory, discriminatory, obscene, or infringes anyone\'s rights;',
                    'scrape, copy or harvest data from the Platform, or build a database from it, or use it to send unsolicited messages;',
                    'try to break, probe or bypass the Platform\'s security, or interfere with its operation, for example with malware or by overloading it;',
                    'access another person\'s account or information, or use the Platform to harass anyone;',
                    'use the Platform to recruit for anything unlawful, or for a job that charges candidates a fee.',
                ]} />
            </>
        ),
    },
    {
        id: 'content-and-ip',
        title: 'Your content and our property',
        body: (
            <>
                <P>
                    You keep ownership of the content you put on the Platform, such as your profile, resume, job postings and documents. You give us a
                    non-exclusive, royalty-free licence to store, process and display it for the purpose of running the Platform and providing the services, including
                    sharing it as described in these terms and our Privacy Policy. This licence ends when your content is deleted, apart from copies we must keep
                    by law or in backups.
                </P>
                <P>
                    The Platform, its software, design, text and brand belong to us or our licensors. You may use them only to use the Platform as intended.
                </P>
            </>
        ),
    },
    {
        id: 'third-parties',
        title: 'Other services',
        body: (
            <P>
                The Platform depends on services from others, such as Google and Microsoft for sign-in and Cashfree for payments. Their own terms apply to
                your use of them, and we are not responsible for them.
            </P>
        ),
    },
    {
        id: 'liability',
        title: 'Our responsibility to you',
        body: (
            <>
                <P>
                    We work to keep the Platform available and accurate, but it is provided "as is" and "as available". To the fullest extent the law allows, we do
                    not promise it will be uninterrupted or error-free, and we are not liable for the actions or statements of companies or candidates, for hiring
                    decisions, or for indirect or consequential loss such as lost profits, lost opportunities or loss of data.
                </P>
                <P>
                    Our total liability to you for any claim arising from the Platform is limited to the fees you paid us in the 12 months before the claim.
                    Nothing in these terms limits liability that cannot be limited under Indian law, such as for fraud or wilful misconduct.
                </P>
                <P>
                    You agree to compensate us for losses we suffer because you break these terms or the law, for example by posting false information
                    or misusing candidate data.
                </P>
            </>
        ),
    },
    {
        id: 'ending',
        title: 'Ending your use',
        body: (
            <>
                <P>
                    You can stop using the Platform and ask us to close your account at any time by writing to <Mail />. We can suspend or end your access if
                    you break these terms or if we have to by law. We may also stop offering the Platform, giving notice where we reasonably can.
                </P>
                <P>
                    Ending your account does not cancel amounts you already owe, such as placement fees for hires we introduced. Terms that by their nature
                    should continue, such as fees, confidentiality, data use, liability and governing law, continue after you stop using the Platform.
                </P>
            </>
        ),
    },
    {
        id: 'changes',
        title: 'Changes to these terms',
        body: (
            <P>
                We may update these terms. We will change the "last updated" date above and, for significant changes, tell you by email or in the Platform. If you
                keep using the Platform after a change takes effect, you accept the new terms. If you do not agree, stop using the Platform.
            </P>
        ),
    },
    {
        id: 'law',
        title: 'Governing law and disputes',
        body: (
            <>
                <P>
                    These terms are governed by the laws of India. Before taking any formal step, please write to us at <Mail /> so we can try to resolve the
                    issue, which we aim to do within 30 days. If we cannot, the courts of competent jurisdiction in {COMPANY.state} will have exclusive
                    jurisdiction.
                </P>
                <P>
                    If any part of these terms is held to be unenforceable, the rest stays in force. Our not enforcing a term immediately does not waive it.
                </P>
            </>
        ),
    },
    {
        id: 'contact',
        title: 'Contact',
        body: (
            <P>
                {COMPANY.legalName}, registered office in {COMPANY.state}. Email: <Mail />.
            </P>
        ),
    },
];

export default function TermsOfService() {
    return (
        <LegalLayout
            title="Terms of Service"
            intro={`These terms set out the rules for using the ${COMPANY.brandName} platform, for candidates and for companies.`}
            sections={sections}
        />
    );
}
