import LegalLayout, { Callout, DefList, H3, Mail, P, UL } from './LegalLayout';
import { COMPANY } from './legalInfo';

const sections = [
    {
        id: 'who-we-are',
        title: 'Who we are',
        body: (
            <>
                <P>
                    {COMPANY.legalName} ("LadderStep", "we", "us") is a company incorporated in India, with its registered office
                    in {COMPANY.state}. We run the {COMPANY.brandName} platform at {COMPANY.site} (the "Platform"), where companies hire
                    and candidates find jobs, with the help of our recruitment executives.
                </P>
                <P>
                    For the personal data described in this policy we decide why and how it is used, so we are the "Data Fiduciary"
                    under the Digital Personal Data Protection Act, 2023 (the "DPDP Act"). This policy also reflects the Information
                    Technology Act, 2000 and the rules made under it.
                </P>
                <P>
                    It applies to candidates, to companies and the people who act for them, to our own staff who use the Platform, and to
                    anyone whose details we hold for recruitment or outreach. Please read it together with our Terms of Service and our
                    Refund &amp; Cancellation Policy.
                </P>
            </>
        ),
    },
    {
        id: 'what-we-collect',
        title: 'What we collect',
        body: (
            <>
                <H3>Everyone with an account</H3>
                <UL items={[
                    'Your name and email address, and the identifier that Google or Microsoft gives us when you sign in with them. We never see your Google or Microsoft password.',
                    'Trainer accounts only: an email address and a password, which we store in scrambled (hashed) form.',
                    'Activity on your account, such as when you last signed in and the notifications we sent you.',
                ]} />

                <H3>Candidates</H3>
                <UL items={[
                    'Your phone number and the profile you build or that we fill in from your resume: headline, summary, current location, experience, skills, education, work history, expected salary, notice period, and links such as LinkedIn or GitHub.',
                    'Your resume files and the text we read from them, and other documents you upload, such as certificates or, for Premium verification, payslips.',
                    'Your applications, interviews, offers and their outcomes, including feedback that a company writes about you after an interview.',
                    'Your job status, if you tell us whether you are looking for a job, working and open to offers, or working and not looking.',
                    'Your messages with our AI assistant, LAILA, if you use it.',
                ]} />

                <H3>Companies</H3>
                <UL items={[
                    'Company name, industry, location, website and description, and the name, email address and phone number of the people who use the account.',
                    'Job postings, shortlisting and interview decisions, offer details, and your agreement with us.',
                    'Invoices and payment records.',
                ]} />

                <H3>Payments</H3>
                <P>
                    Payments are handled by Cashfree Payments, our payment gateway. We receive the order reference, amount, payment status and the type
                    of payment method used. We do not receive or store your card number, UPI PIN or net-banking credentials.
                </P>

                <H3>Messages and calls</H3>
                <P>
                    Emails and WhatsApp messages you send us or reply to, including any photos, documents or voice messages, the name shown on your
                    WhatsApp profile, and notes our executives make about calls with you. When we send you a file on WhatsApp, it is shared as a private link that
                    stops working after 30 days.
                </P>

                <H3>Technical information</H3>
                <P>
                    Your IP address and browser details in our server logs, and in the audit log we keep of sensitive actions on the Platform, for
                    security and to investigate misuse.
                </P>
            </>
        ),
    },
    {
        id: 'sourced-candidates',
        title: 'Candidates added by our executives',
        body: (
            <>
                <P>
                    Our recruitment executives may create a candidate record from a resume that was sent or given to us. Such a record can include a name,
                    email address, phone number, skills and work history. The person has not signed in to the Platform, and we keep their record to
                    consider them for suitable roles.
                </P>
                <P>
                    If this is you, you can ask us to show you the record, correct it, or delete it at any time by writing to <Mail />. Until you sign in
                    yourself we do not send you automated reminders, and we only contact you about opportunities that match your background.
                </P>
            </>
        ),
    },
    {
        id: 'how-we-use',
        title: 'How we use your information',
        body: (
            <>
                <UL items={[
                    'To run the Platform: create and secure your account, show your profile to the right people, and let companies post jobs, review applicants and manage interviews and offers.',
                    'To match candidates with jobs, and to let our executives source candidates, arrange interviews and coordinate offers.',
                    'To take payments, issue invoices and keep the tax and accounting records the law requires.',
                    'To send service messages: confirmations, interview and offer updates, invoices, security alerts, and, for candidates who have signed in, occasional reminders to keep their job status up to date.',
                    'To prevent fraud and misuse, keep the Platform secure, and resolve disputes.',
                    'To improve the Platform, for example by looking at how features are used.',
                    'To comply with the law and respond to lawful requests from authorities.',
                ]} />
                <P>
                    We use your information where you have given your consent, where you have asked us for a service, or for other purposes the
                    DPDP Act permits, such as meeting a legal obligation. You can withdraw consent at any time (see "Your rights").
                </P>
            </>
        ),
    },
    {
        id: 'automated-matching-and-ai',
        title: 'Automated matching and AI',
        body: (
            <>
                <P>
                    The match score between a candidate and a job comes from our own software, which compares skills and experience using a fixed formula. A
                    person at the hiring company, or one of our executives, makes the decision to shortlist, interview or hire. No hiring decision is
                    made by software alone.
                </P>
                <P>
                    Some features use an AI language model: LAILA (our AI assistant), suggestions from your resume, and short notes explaining why a
                    candidate fits a job. These run on a model hosted on our own servers, so your resume text and chat messages are not sent to an
                    outside AI provider. The one exception is course recommendations for hired employees, which send only a job title, skill names and
                    course titles, never names or contact details, to OpenAI.
                </P>
                <P>
                    AI can make mistakes. LAILA always shows you a preview and waits for your confirmation before it changes anything.
                </P>
            </>
        ),
    },
    {
        id: 'who-sees-it',
        title: 'Who can see your information',
        body: (
            <>
                <Callout>
                    <strong>Companies see candidate contact details.</strong> When you apply to a job, or one of our executives puts you forward for it, the
                    hiring company can see your name, email address, phone number, location, experience, skills, expected salary, notice period and
                    cover letter, and can download your resume. We do not hide these from companies.
                </Callout>
                <UL items={[
                    'Only companies that you applied to, or that we put you forward to, can see your profile. Companies cannot browse the whole candidate database.',
                    'Your job status (looking, open to offers, or not looking) is visible only to our own staff. It is never shown to companies.',
                    'Documents such as payslips and certificates are visible to our staff. A company sees them only if they are shared through your LadderStep executive.',
                    'If you are a Premium candidate, companies see a Premium badge. The payslips used to verify it are reviewed by our team and are not shown to companies.',
                    'Our executives and administrators can see the information they need to run the service. Access depends on their role, and sensitive actions are logged.',
                ]} />

                <H3>Service providers who process data for us</H3>
                <DefList rows={[
                    ['Amazon Web Services', 'Hosts the Platform and stores uploaded files, in the Mumbai (India) region.'],
                    ['Cashfree Payments', 'Processes payments. Receives your name, email, phone number and payment details at checkout.'],
                    ['Google', 'Sign-in for candidates and companies. Also serves the typefaces our pages use (your browser contacts Google when a page loads).'],
                    ['Microsoft', 'Sign-in for our staff, and delivery of our emails (service emails and, for business contacts, outreach emails).'],
                    ['WhatsApp (via Vaartabot)', 'Delivers WhatsApp messages from us, and brings your replies back to us.'],
                    ['OpenAI', 'Course recommendations only, using job titles and skill names with no personal details.'],
                ]} />

                <H3>Others</H3>
                <UL items={[
                    'Authorities, courts and regulators, where the law requires or a valid order asks us to disclose information.',
                    'A buyer or successor, if the business is sold or merged, who must honour this policy.',
                ]} />
                <P>We do not sell your personal data.</P>
            </>
        ),
    },
    {
        id: 'where-stored',
        title: 'Where your data is stored',
        body: (
            <P>
                Our servers and file storage are in India (AWS Mumbai). Some of the providers above, such as Google, Microsoft, WhatsApp and
                OpenAI, may process the limited data described there outside India. We only use providers that apply appropriate safeguards, and we
                share no more than each one needs.
            </P>
        ),
    },
    {
        id: 'cookies',
        title: 'Cookies and similar technologies',
        body: (
            <>
                <UL items={[
                    'One essential cookie keeps you signed in. It is not readable by scripts on the page and lasts for up to seven days, or until you sign out.',
                    'Google sets its own cookies on the sign-in page, and the Microsoft sign-in library keeps a temporary value in your browser while you sign in.',
                    'Your browser may also keep small items in session storage, for example to remember that you dismissed a prompt.',
                ]} />
                <P>We do not use advertising cookies or third-party analytics trackers on the Platform.</P>
            </>
        ),
    },
    {
        id: 'how-long',
        title: 'How long we keep it',
        body: (
            <UL items={[
                'Account and profile: for as long as your account is open.',
                'After you close your account or ask us to delete your data, we remove or anonymise your personal details from the Platform. Copies in our backups are overwritten after a limited period.',
                'Invoices, payment and tax records: for as long as the law requires, generally up to eight years.',
                'Records of candidates hired through the Platform: for the period needed to administer placement fees and meet the law.',
                'Audit logs: for as long as needed for security and to investigate misuse.',
                'Candidate records created by our executives: only while they are useful for recruitment, and no longer than that.',
            ]} />
        ),
    },
    {
        id: 'security',
        title: 'How we protect it',
        body: (
            <>
                <P>
                    We use encrypted connections (HTTPS), role-based access so people only see what their job requires, hashed passwords, a logged record of
                    sensitive actions, and limits on repeated sign-in attempts. Uploaded files are not served publicly. They are available only through the
                    Platform to people who are allowed to see them.
                </P>
                <P>
                    No system is perfectly secure. If you think your account has been misused, or you find a security problem, write to us straight away
                    at <Mail />. If a breach affects your personal data, we will tell you and the authorities as the law requires.
                </P>
            </>
        ),
    },
    {
        id: 'your-rights',
        title: 'Your rights',
        body: (
            <>
                <P>Under the DPDP Act you have the right to:</P>
                <UL items={[
                    'get a summary of the personal data we hold about you and how it is used;',
                    'have inaccurate or incomplete data corrected, and ask us to erase data you no longer want us to hold;',
                    'withdraw your consent at any time. This does not affect what we did before, and we may then be unable to provide the service;',
                    'have a complaint about how your data is handled dealt with (see "Grievances and contact");',
                    'nominate another person to exercise these rights for you if you die or cannot act for yourself.',
                ]} />
                <P>
                    You can edit your profile, replace or delete your resume, withdraw applications and cancel LAILA yourself in the Platform. For anything
                    else, write to <Mail /> from the email address on your account, or tell us enough for us to confirm who you are. We aim to reply within 30
                    days. Deleting your data may mean we can no longer provide the service to you, and we will keep what the law requires us to keep.
                </P>
            </>
        ),
    },
    {
        id: 'marketing',
        title: 'Outreach and marketing messages',
        body: (
            <P>
                We sometimes email or message businesses about our services, using business contact details. You can ask us to stop at any time by
                replying or writing to <Mail />, and we will record your request and stop. WhatsApp messages are sent only through approved message
                templates.
            </P>
        ),
    },
    {
        id: 'children',
        title: 'Children',
        body: (
            <P>
                The Platform is for people aged 18 and over. We do not knowingly collect personal data from anyone under 18. If you believe we have,
                tell us and we will delete it.
            </P>
        ),
    },
    {
        id: 'changes',
        title: 'Changes to this policy',
        body: (
            <P>
                We may update this policy from time to time. We will change the "last updated" date above and, for significant changes, tell
                you by email or in the Platform. Using the Platform after a change means you accept the updated policy.
            </P>
        ),
    },
    {
        id: 'contact',
        title: 'Grievances and contact',
        body: (
            <>
                <P>
                    For questions, requests or complaints about your personal data, contact our Grievance Officer at {COMPANY.legalName}, by email
                    at <Mail />, with "Privacy" in the subject line. We will acknowledge your message and aim to resolve it within 30 days.
                </P>
                <P>
                    If you are not satisfied with our response, you may complain to the Data Protection Board of India once it is in operation under the DPDP Act.
                </P>
            </>
        ),
    },
];

export default function PrivacyPolicy() {
    return (
        <LegalLayout
            title="Privacy Policy"
            intro={`This policy explains what personal information ${COMPANY.legalName} collects through the ${COMPANY.brandName} platform, why we collect it, who can see it, and the choices you have.`}
            sections={sections}
        />
    );
}
