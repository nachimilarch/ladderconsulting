import { Link } from 'react-router-dom';
import LegalLayout, { Callout, DefList, Mail, P, UL } from './LegalLayout';
import { COMPANY } from './legalInfo';

const sections = [
    {
        id: 'summary',
        title: 'At a glance',
        body: (
            <>
                <Callout>
                    Applying for jobs is free for candidates. This policy covers the paid services: the job posting fee, placement fees, Premium,
                    the LAILA subscription and training services. All amounts are in Indian Rupees.
                </Callout>
                <DefList rows={[
                    ['Job posting fee', 'Refundable in full if you ask within 24 hours of paying and the job has had no applications. Not refundable after that.'],
                    ['Placement fee', 'Cancelled or refunded in full if the candidate declines the offer, or the offer is withdrawn before the candidate accepts it. After acceptance, the terms of your agreement with us apply.'],
                    ['Premium (candidates)', 'Not refundable once Premium is active. Refundable if you paid and it was not activated.'],
                    ['LAILA subscription', 'Cancel any time, effective immediately. No refund for the month already paid. Refundable if you are charged after cancelling.'],
                    ['Training services', 'Full refund if cancelled at least 7 days before the start date. Later cancellations are not refunded, but participants can usually be moved to another batch.'],
                    ['Any service', 'Always refunded in full if you were charged twice, charged the wrong amount, or paid and we could not deliver because of a fault on our side.'],
                ]} />
            </>
        ),
    },
    {
        id: 'job-posting',
        title: 'Job posting fee',
        body: (
            <>
                <P>
                    Companies on the standard plan pay a fee for each job they publish. The fee covers publishing the job, matching candidates to it and our executives'
                    sourcing work, which begins as soon as the job is live.
                </P>
                <UL items={[
                    'You can cancel and get a full refund if you write to us within 24 hours of paying, and the job has not yet received any application and we have not put any candidate forward for it.',
                    'If you paid but the job could not be published because of a problem on our side, we will publish it or refund the fee, whichever you prefer.',
                    'In every other case the fee is not refundable, including when you close the job, fill it another way, or change your mind after candidates have been sourced.',
                ]} />
            </>
        ),
    },
    {
        id: 'placement-fee',
        title: 'Placement fee',
        body: (
            <>
                <P>
                    A placement fee is invoiced when we approve your request to release an offer letter, and is calculated on the offered annual CTC as
                    explained in our <Link to="/terms-of-service" className="link">Terms of Service</Link>. GST is added at the applicable rate.
                </P>
                <UL items={[
                    'If the candidate declines the offer, or the offer is withdrawn before the candidate accepts it, we will cancel the invoice, or refund in full anything you have already paid towards it.',
                    'Once the candidate has accepted the offer, the fee is payable. Any replacement, refund or guarantee period for a candidate who leaves early is the one set out in your signed agreement with us. This policy does not add to or reduce it.',
                    'If your agreement is silent on early exits, write to us and we will consider the case fairly.',
                ]} />
            </>
        ),
    },
    {
        id: 'premium',
        title: 'Premium (candidates)',
        body: (
            <>
                <P>
                    Premium is a one-time fee that you pay after we have reviewed your payslips and approved your verification. Because the benefit starts as soon
                    as Premium is active:
                </P>
                <UL items={[
                    'The fee is not refundable once your Premium status is active.',
                    'If you paid and Premium was not activated on your account, we will activate it or refund the fee in full.',
                    'If your Premium status is removed because information or documents you gave us turn out to be false, the fee is not refunded.',
                    'Verification itself is free. You pay only after we approve it, and you may decide not to pay.',
                ]} />
            </>
        ),
    },
    {
        id: 'laila',
        title: 'LAILA subscription',
        body: (
            <>
                <P>
                    LAILA, our AI assistant, is billed monthly. Each month we raise a renewal invoice that you pay to continue. If you do not pay, access carries on
                    for a short grace period and is then suspended, and nothing further is charged.
                </P>
                <UL items={[
                    'You can cancel at any time in the Platform, from the LAILA subscription card on your profile page.',
                    'Cancelling takes effect straight away: access ends and no further invoices are raised. So the best time to cancel is just before a renewal is due.',
                    'We do not refund the month you have already paid for, and we do not give part-month refunds.',
                    'If you are charged after you cancelled, or if LAILA was unavailable for most of a paid month because of a problem on our side, we will refund that month in full.',
                ]} />
            </>
        ),
    },
    {
        id: 'training',
        title: 'Training services',
        body: (
            <UL items={[
                'You can cancel a training request, and get a full refund, if you write to us at least 7 days before the start date.',
                'If you cancel with less notice we do not refund the fee, but we will normally move your participants to another batch at no extra cost.',
                'If we cancel or reschedule and the new date does not suit you, we will refund the fee in full.',
                'Once training has started, we do not refund the part already delivered.',
            ]} />
        ),
    },
    {
        id: 'always',
        title: 'When we always refund',
        body: (
            <UL items={[
                'You were charged more than once for the same thing.',
                'You were charged an amount different from the price you were shown.',
                'You paid, and we could not deliver the service because of a fault on our side, and we could not put it right.',
                'A payment was made from your account without your authority. Tell us as soon as you notice, and also tell your bank.',
            ]} />
        ),
    },
    {
        id: 'how-to-ask',
        title: 'How to ask for a refund or cancellation',
        body: (
            <>
                <P>
                    Write to <Mail /> from the email address on your account, with the invoice number or payment reference, the amount, and what happened. Please
                    do this within 30 days of the payment, or sooner where a shorter time is given above.
                </P>
                <UL items={[
                    'We will reply within 3 working days.',
                    'If your refund is approved, we start it within 7 working days.',
                    'The money goes back to the payment method you used, through our payment gateway, and usually reaches you within 5 to 7 working days after that, depending on your bank or card issuer.',
                    'You get back the full amount you paid, including GST, and we issue a credit note for the tax invoice where one applies.',
                    'If the original payment method is no longer available, tell us and we will agree another way to pay you back, after confirming who you are.',
                ]} />
            </>
        ),
    },
    {
        id: 'failed-payments',
        title: 'Payment failed but money was deducted',
        body: (
            <P>
                Sometimes a payment shows as failed or pending while your account is debited. In most cases your bank reverses it automatically within 5 to 7 working
                days. If it does not, or if the Platform shows no payment after you were charged, write to us with the transaction reference and we will check with our
                payment gateway and either confirm the payment or refund you.
            </P>
        ),
    },
    {
        id: 'chargebacks',
        title: 'Disputing a payment with your bank',
        body: (
            <P>
                Please write to us before raising a dispute with your bank or card issuer. We can usually fix a problem faster that way. If a dispute is
                raised, we will give the payment gateway the records they ask for.
            </P>
        ),
    },
    {
        id: 'changes',
        title: 'Changes and contact',
        body: (
            <>
                <P>
                    We may update this policy. A change applies to payments made after it takes effect. The version in force when you paid is the one that applies
                    to that payment. Our <Link to="/privacy-policy" className="link">Privacy Policy</Link> and{' '}
                    <Link to="/terms-of-service" className="link">Terms of Service</Link> work alongside this policy.
                </P>
                <P>
                    {COMPANY.legalName}, registered office in {COMPANY.state}. Email: <Mail />.
                </P>
            </>
        ),
    },
];

export default function RefundPolicy() {
    return (
        <LegalLayout
            title="Refund & Cancellation Policy"
            intro={`This policy explains how to cancel a paid ${COMPANY.brandName} service and when you can get your money back.`}
            sections={sections}
        />
    );
}
