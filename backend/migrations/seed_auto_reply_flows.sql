-- Seed Auto-Reply Flows for LadderStep Human Consulting
-- WhatsApp flows: response_type='text', no template linked → logged for manual follow-up
-- Email flows: actual auto-replies sent via outreach SMTP
--
-- Run AFTER email_auto_reply_flows.sql migration
-- Requires: admin user with id=1 (adjust @admin_id if different)

SET @admin_id = (
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'admin' AND u.deleted_at IS NULL LIMIT 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP AUTO-REPLY FLOWS
-- Order matters: stop/opt-out first, then specific triggers, then catch-alls
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Opt-Out / Stop (highest priority — always first)
INSERT INTO whatsapp_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, response_text, is_active)
VALUES (
    @admin_id,
    'Opt-Out / Stop',
    'keyword',
    '["stop","unsubscribe","opt out","opt-out","remove","remove me","no thanks","not interested","do not contact"]',
    'contains',
    'text',
    'Thank you for letting us know. You have been removed from our list and will not receive further messages from LadderStep. We wish you all the best!',
    1
);

-- 2. First Contact Welcome
INSERT INTO whatsapp_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, response_text, is_active)
VALUES (
    @admin_id,
    'First Contact Welcome',
    'first_contact',
    '[]',
    'contains',
    'text',
    'Hello! Welcome to LadderStep Human Consulting — your trusted partner for Recruitment, Talent Solutions & Corporate Training.

Reply with:
*1* — Hiring / Recruitment Solutions
*2* — Job Opportunities (Looking for work)
*3* — Corporate Training Programs
*4* — Connect with our team

We will get back to you within 24 hours.',
    1
);

-- 3. Hiring / Recruitment Enquiry
INSERT INTO whatsapp_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, response_text, is_active)
VALUES (
    @admin_id,
    'Hiring & Recruitment Enquiry',
    'keyword',
    '["1","hire","hiring","recruit","recruitment","talent","candidate","vacancy","vacancies","staff","staffing","placement","headhunt","executive search","sourcing","manpower","workforce"]',
    'contains',
    'text',
    'Great! LadderStep specialises in end-to-end recruitment solutions:

• Executive & Leadership Hiring
• Mid-level & Entry-level Recruitment
• Resume Sourcing & Shortlisting
• Interview Coordination & Scheduling
• Offer Management

Please share your requirements (role, team size, location) and our recruitment consultant will get back to you within 24 hours.

You can also email us at: info@theladderconsulting.com',
    1
);

-- 4. Job Seeker / Candidate Enquiry
INSERT INTO whatsapp_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, response_text, is_active)
VALUES (
    @admin_id,
    'Job Seeker / Candidate',
    'keyword',
    '["2","job","jobs","career","careers","opportunity","opportunities","looking for work","employment","work","position","opening","openings","apply","resume","cv","fresher","experience"]',
    'contains',
    'text',
    'We would love to help you find your next role!

To get started:
1. Register on our platform: theladderconsulting.com
2. Build your profile and upload your resume
3. Get matched with top opportunities from our client companies

Our team will reach out personally when we find a strong match for your profile.

For urgent enquiries, email us at: careers@theladderconsulting.com',
    1
);

-- 5. Corporate Training Enquiry
INSERT INTO whatsapp_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, response_text, is_active)
VALUES (
    @admin_id,
    'Corporate Training Enquiry',
    'keyword',
    '["3","training","train","course","courses","learn","learning","skill","skills","workshop","upskill","reskill","certification","programme","program","development","corporate training","leadership","soft skills"]',
    'contains',
    'text',
    'Excellent! LadderStep offers customised Corporate Training programmes:

*What we cover:*
• Leadership & Management Development
• Sales & Communication Skills
• Technical Upskilling
• HR & People Management
• Soft Skills & Workplace Effectiveness

Please share your team size and training area of interest and we will send you a customised proposal within 48 hours.',
    1
);

-- 6. Interested / Want More Info
INSERT INTO whatsapp_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, response_text, is_active)
VALUES (
    @admin_id,
    'Interested / More Info',
    'keyword',
    '["4","interested","yes","tell me more","more info","more information","details","how does it work","how","pricing","price","cost","connect","call me","meeting","talk","speak","consultant"]',
    'contains',
    'text',
    'Wonderful! Our team would love to connect with you.

A LadderStep consultant will reach out to you shortly to understand your needs and explain how we can help.

In the meantime, you can:
• Visit: theladderconsulting.com
• Email: info@theladderconsulting.com

Thank you for your interest — we look forward to speaking with you!',
    1
);

-- 7. Thank You / Acknowledgement
INSERT INTO whatsapp_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, response_text, is_active)
VALUES (
    @admin_id,
    'Thank You / Acknowledgement',
    'keyword',
    '["thank","thanks","thank you","thankyou","noted","ok","okay","great","perfect","received","got it","sure","alright"]',
    'contains',
    'text',
    'You are welcome! Feel free to reach out anytime — the LadderStep team is always here to help.

Have a great day!',
    1
);


-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL AUTO-REPLY FLOWS
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Opt-Out (highest priority)
INSERT INTO email_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_subject, response_body)
VALUES (
    @admin_id,
    'Opt-Out / Unsubscribe',
    'keyword',
    '["unsubscribe","opt out","opt-out","remove me","stop emailing","do not contact","remove from list"]',
    'contains',
    'Unsubscribe Confirmed — LadderStep Human Consulting',
    'Dear Contact,

Thank you for letting us know.

We have removed you from our mailing list and you will not receive any further outreach emails from LadderStep Human Consulting.

We apologise for any inconvenience and wish you all the best.

Warm regards,
The LadderStep Team
theladderconsulting.com | info@theladderconsulting.com'
);

-- 2. Hiring / Recruitment Enquiry
INSERT INTO email_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_subject, response_body)
VALUES (
    @admin_id,
    'Hiring & Recruitment Enquiry',
    'keyword',
    '["hire","hiring","recruit","recruitment","talent","candidate","vacancy","vacancies","staffing","placement","headhunt","executive search","manpower","sourcing"]',
    'contains',
    'Re: Recruitment Solutions — LadderStep Human Consulting',
    'Dear Hiring Professional,

Thank you for your interest in LadderStep Human Consulting''s recruitment services!

We specialise in end-to-end talent acquisition:

WHAT WE OFFER:
• Executive & Leadership Search
• Mid-level and Entry-level Recruitment
• Resume Sourcing & Shortlisting
• Interview Coordination and Scheduling
• Offer Negotiation & Onboarding Support
• Workforce Planning & HR Consulting

OUR PROCESS:
1. We understand your hiring requirements in detail
2. We source and screen candidates from our talent pool
3. We present a curated shortlist within 5–7 business days
4. We coordinate interviews and manage the offer process
5. We stay on until the candidate joins successfully

One of our recruitment consultants will be in touch with you within 24 hours to schedule a discovery call.

In the meantime, feel free to share your job requirements by replying to this email.

Warm regards,
LadderStep Human Consulting
info@theladderconsulting.com | theladderconsulting.com'
);

-- 3. Job Seeker / Candidate Enquiry
INSERT INTO email_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_subject, response_body)
VALUES (
    @admin_id,
    'Job Seeker / Candidate',
    'keyword',
    '["job","career","opportunity","looking for work","employment","apply","resume","cv","fresher","job search","placement","open to work","available","open roles"]',
    'contains',
    'Re: Job Opportunities — LadderStep Human Consulting',
    'Dear Candidate,

Thank you for reaching out to LadderStep Human Consulting!

We are excited to help you find your next career opportunity. Here is how we can support you:

HOW IT WORKS:
1. Register on our platform at theladderconsulting.com
2. Complete your profile and upload your resume
3. Our AI-powered matching system will identify the best-fit roles for you
4. Our recruitment team will review your profile and reach out personally

WHAT WE OFFER CANDIDATES:
• Access to exclusive job openings with top companies
• Personalised career guidance from our consultants
• Resume review and interview preparation support
• End-to-end placement assistance — from shortlisting to offer

To get started, please visit: theladderconsulting.com/register

One of our consultants will follow up with you shortly.

Best regards,
LadderStep Human Consulting
careers@theladderconsulting.com | theladderconsulting.com'
);

-- 4. Corporate Training Enquiry
INSERT INTO email_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_subject, response_body)
VALUES (
    @admin_id,
    'Corporate Training Enquiry',
    'keyword',
    '["training","course","workshop","upskill","reskill","skill development","learning","certification","corporate training","leadership program","soft skills","professional development"]',
    'contains',
    'Re: Corporate Training Solutions — LadderStep Human Consulting',
    'Dear Professional,

Thank you for your interest in LadderStep''s Corporate Training programmes!

We design and deliver customised training solutions for organisations of all sizes.

OUR TRAINING PROGRAMMES:
• Leadership & Management Development
• Sales Effectiveness & Customer Engagement
• Communication & Presentation Skills
• HR Management & People Practices
• Technical Skills & Digital Literacy
• Soft Skills & Emotional Intelligence
• Compliance & Workplace Culture

HOW WE WORK:
1. Training needs assessment with your team
2. Customised curriculum design
3. Delivery (in-person, virtual, or blended)
4. Post-training assessment and certification

We will send you our training catalogue and pricing within 24 hours. To help us prepare the right proposal, could you share:
- Number of participants
- Training area(s) of interest
- Preferred format (online / in-person / hybrid)
- Timeline

Simply reply to this email with the details and our training specialist will get in touch.

Warm regards,
LadderStep Human Consulting
training@theladderconsulting.com | theladderconsulting.com'
);

-- 5. Pricing / Cost Enquiry
INSERT INTO email_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_subject, response_body)
VALUES (
    @admin_id,
    'Pricing & Cost Enquiry',
    'keyword',
    '["price","pricing","cost","fee","charges","rate","quote","quotation","proposal","package","how much"]',
    'contains',
    'Re: Pricing & Solutions — LadderStep Human Consulting',
    'Dear Contact,

Thank you for your message!

Our pricing is customised based on your specific requirements. Here is a brief overview:

RECRUITMENT SERVICES:
• Pricing is typically a percentage of the placed candidate''s annual CTC
• Volume discounts available for multiple hires
• No upfront fees — you pay only on successful placement

CORPORATE TRAINING:
• Customised per programme based on team size, duration, and delivery format
• Group discounts available
• Flexible payment options

TALENT POOL ACCESS:
• Flexible package options to suit your hiring volume
• Contact us for current pricing and package details

To provide you with an accurate quote, one of our consultants will reach out within 24 hours. Please feel free to share your specific needs by replying to this email.

Warm regards,
LadderStep Human Consulting
info@theladderconsulting.com | theladderconsulting.com'
);

-- 6. General Interest / Follow-Up
INSERT INTO email_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_subject, response_body)
VALUES (
    @admin_id,
    'General Interest',
    'keyword',
    '["interested","more information","tell me more","more details","how does it work","connect","schedule a call","meeting","demo","know more","find out more","collaboration","partner","partnership"]',
    'contains',
    'Re: LadderStep Human Consulting — Thank You for Your Interest',
    'Dear Contact,

Thank you for your interest in LadderStep Human Consulting!

We are a full-service HR and Talent Solutions firm offering:

• Recruitment & Executive Search
• Resume Sourcing & Candidate Shortlisting
• Interview & Offer Management
• Corporate Training Programmes
• HR Consulting & Workforce Planning

A member of our team will reach out to you within 24 hours to understand your requirements and discuss how LadderStep can add value to your organisation.

In the meantime, you are welcome to explore our platform at theladderconsulting.com

Warm regards,
LadderStep Human Consulting
info@theladderconsulting.com | theladderconsulting.com'
);

-- 7. First Contact Welcome (fires for anyone who has never received a campaign email before)
INSERT INTO email_auto_reply_flows
    (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_subject, response_body)
VALUES (
    @admin_id,
    'First Contact Welcome',
    'first_contact',
    '[]',
    'contains',
    'Thank You for Reaching Out — LadderStep Human Consulting',
    'Dear Contact,

Thank you for reaching out to LadderStep Human Consulting!

We are delighted to hear from you. LadderStep is a full-service Human Consulting firm specialising in:

• Recruitment & Talent Acquisition
• Executive & Leadership Search
• Corporate Training & Skill Development
• HR Consulting & Workforce Planning

A member of our team will review your message and get back to you within 24 hours.

You are also welcome to visit our platform at theladderconsulting.com to explore our services.

Warm regards,
LadderStep Human Consulting
info@theladderconsulting.com | theladderconsulting.com'
);
