// The hiring-staff workflow in one place, so the stepper, the "next step" card and the
// "waiting on you" list always agree: companies -> sourcing -> interviews -> offers -> placements.

import { inr } from '../../utils/money';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const buildHrWorkflow = ({ hiring, premium = { company: 0, candidate: 0 }, tasksPending = 0, isAdmin = false }) => {
    const k = hiring?.kpis || {};
    const companies = hiring?.scope?.companies ?? 0;
    const interviewReqs = hiring?.pending_actions?.interview_requests || [];
    const offerReqs = hiring?.pending_actions?.offer_requests || [];

    // Count what can actually be opened and approved (the lists), not the raw KPI.
    const nInterviews = interviewReqs.length;
    const nOffers = offerReqs.length;
    const outstanding = Number(k.outstanding_amount || 0);
    const unconfirmed = Number(k.awaiting_candidate_confirmation || 0);

    const steps = [
        {
            key: 'companies', label: 'Companies', to: '/hr/companies',
            detail: companies ? `${companies} ${isAdmin ? 'in total' : 'assigned'}` : 'None yet',
            attention: companies === 0 && !isAdmin,
        },
        {
            key: 'sourcing', label: 'Sourcing', to: '/hr/sourcing',
            detail: `${Number(k.active_jobs || 0)} open ${Number(k.active_jobs || 0) === 1 ? 'job' : 'jobs'}`,
        },
        {
            key: 'interviews', label: 'Interviews', to: '/hr/interviews',
            count: nInterviews, attention: nInterviews > 0,
            detail: nInterviews ? `${nInterviews} to approve` : k.upcoming_interviews ? `${k.upcoming_interviews} upcoming` : 'All clear',
        },
        {
            key: 'offers', label: 'Offers', to: '/hr/offer-requests',
            count: nOffers, attention: nOffers > 0,
            detail: nOffers ? `${nOffers} to approve` : k.offers_pending ? `${k.offers_pending} out` : 'All clear',
        },
        {
            key: 'placements', label: 'Placements', to: '/hr/invoices',
            attention: outstanding > 0,
            detail: outstanding > 0 ? `${inr(outstanding)} due` : `${Number(k.hires_total || 0)} hired`,
        },
    ];

    // The single most useful thing to do right now, most urgent first.
    let next;
    if (nInterviews) {
        const r = interviewReqs[0];
        next = {
            tone: 'amber', icon: '🗓', urgent: true,
            title: `${plural(nInterviews, 'interview request', 'interview requests')} waiting for you`,
            text: r ? `${r.company_name}: ${r.candidate_name} for ${r.job_title}${nInterviews > 1 ? `, and ${nInterviews - 1} more.` : '.'} Approve it so the candidate gets a slot.` : 'Approve them so candidates get a slot.',
            cta: 'Review requests', to: '/hr/interviews',
        };
    } else if (nOffers) {
        const r = offerReqs[0];
        next = {
            tone: 'amber', icon: '📋', urgent: true,
            title: `${plural(nOffers, 'offer request', 'offer requests')} to approve`,
            text: r ? `${r.company_name}: ${r.candidate_name} for ${r.job_title}${nOffers > 1 ? `, and ${nOffers - 1} more.` : '.'} Approving raises the placement fee invoice.` : 'Approving raises the placement fee invoice.',
            cta: 'Review offers', to: '/hr/offer-requests',
        };
    } else if (premium.candidate) {
        next = {
            tone: 'amber', icon: '🌟', urgent: true,
            title: `${plural(premium.candidate, 'Premium candidate', 'Premium candidates')} to verify`,
            text: 'Check the payslips. Approved candidates can pay the ₹999 fee and get listed first.',
            cta: 'Review payslips', to: '/hr/premium-candidate-requests',
        };
    } else if (premium.company) {
        next = {
            tone: 'amber', icon: '⭐', urgent: true,
            title: `${plural(premium.company, 'company', 'companies')} asking for Platinum`,
            text: 'Platinum companies post jobs for free and pay an 8.33% placement fee per hire.',
            cta: 'Review requests', to: '/hr/premium-requests',
        };
    } else if (unconfirmed) {
        next = {
            tone: 'blue', icon: '⏳',
            title: `${plural(unconfirmed, 'interview', 'interviews')} waiting for the candidate`,
            text: 'The slot is set but the candidate has not confirmed. You can confirm on their behalf if you have spoken to them.',
            cta: 'See scheduled interviews', to: '/hr/scheduled-interviews',
        };
    } else if (outstanding > 0) {
        next = {
            tone: 'blue', icon: '🧾',
            title: `${inr(outstanding)} in placement fees to collect`,
            text: `${plural(Number(k.pending_invoices || 0), 'invoice is', 'invoices are')} still unpaid. Follow up with the company.`,
            cta: 'Open invoices', to: '/hr/invoices',
        };
    } else if (companies === 0 && !isAdmin) {
        next = {
            tone: 'indigo', icon: '🏢',
            title: 'No companies assigned to you yet',
            text: 'Once an admin assigns a company, its jobs, interviews and offers show up here.',
            cta: 'Open my companies', to: '/hr/companies',
        };
    } else if (tasksPending > 0) {
        next = {
            tone: 'indigo', icon: '✅',
            title: `You have ${plural(tasksPending, 'open task', 'open tasks')}`,
            text: 'Nothing is waiting on an approval, so this is a good time to clear them.',
            cta: 'Open tasks', to: '/hr/tasks',
        };
    } else {
        next = {
            tone: 'green', icon: '🎉',
            title: "You're all caught up",
            text: `${plural(Number(k.active_jobs || 0), 'job is', 'jobs are')} open. Source more candidates to keep the pipeline moving.`,
            cta: 'Go to Resume Sourcing', to: '/hr/sourcing',
        };
    }

    // Rows for the "Waiting on you" list.
    const waiting = [
        ...interviewReqs.map((r) => ({
            key: `iv-${r.id}`, kind: 'Interview', icon: '🗓', to: `/hr/interview-requests/${r.id}`,
            title: r.company_name, sub: `${r.candidate_name}, ${r.job_title}`,
        })),
        ...offerReqs.map((r) => ({
            key: `of-${r.id}`, kind: 'Offer', icon: '📋', to: `/hr/offer-requests/${r.id}`,
            title: r.company_name, sub: `${r.candidate_name}, ${r.job_title}`,
            right: r.placement_fee_amount != null ? inr(r.placement_fee_amount) : null,
        })),
    ];

    return { steps, next, waiting };
};
