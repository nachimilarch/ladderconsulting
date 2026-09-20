// The company hiring workflow in one place, so the stepper, the "next step" card and the
// sidebar badges always agree: profile -> post a job -> review candidates -> interview -> hire.
import { inr } from '../../utils/money';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const fmtWhen = (d) =>
    new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// `dash` is GET /companies/dashboard, `fees` is the placement fee summary (may be null).
export const buildCompanyWorkflow = ({ dash, fees }) => {
    const company = dash?.company || {};
    const jobs = dash?.jobs || {};
    const apps = dash?.applications || {};
    const iv = dash?.interviews || {};
    const offers = dash?.offers || {};

    const activeJobs = Number(jobs.active_jobs || 0);
    const unpaidJobs = Number(jobs.pending_payment_jobs || 0);
    const toReview = Number(apps.to_review || 0);
    const shortlisted = Number(apps.shortlisted || 0);
    const totalApps = Number(apps.total_applications || 0);
    const hired = Number(apps.hired || 0);
    const awaitingOutcome = Number(iv.awaiting_outcome || 0);
    const upcoming = Number(iv.upcoming || 0);
    const offersWaiting = Number(offers.waiting || 0);
    const feeDue = Number(fees?.summary?.outstanding || 0);
    const feeInvoices = Number(fees?.summary?.pending_count || 0) + Number(fees?.summary?.partially_paid_count || 0);

    const profileDone = !!(company.industry && company.headquarters);
    const everInterviewed = awaitingOutcome > 0 || upcoming > 0
        || Number(apps.interviews || 0) > 0 || Number(apps.offers_sent || 0) > 0 || hired > 0;

    const steps = [
        {
            key: 'profile', label: 'Profile', to: '/company/profile',
            done: profileDone, detail: profileDone ? 'Complete' : 'Add details',
        },
        {
            key: 'job', label: 'Post a job', to: '/company/jobs',
            done: activeJobs > 0, attention: unpaidJobs > 0, count: unpaidJobs,
            detail: unpaidJobs ? `${unpaidJobs} to pay` : activeJobs ? `${activeJobs} live` : 'Post one',
        },
        {
            key: 'candidates', label: 'Candidates', to: '/company/shortlist',
            done: shortlisted > 0 || everInterviewed, attention: toReview > 0, count: toReview,
            detail: toReview ? `${toReview} to review` : shortlisted ? `${shortlisted} shortlisted` : totalApps ? `${totalApps} applied` : 'None yet',
        },
        {
            key: 'interview', label: 'Interviews', to: '/company/interviews',
            done: everInterviewed && awaitingOutcome === 0, attention: awaitingOutcome > 0, count: awaitingOutcome,
            detail: awaitingOutcome ? `${awaitingOutcome} need outcome` : upcoming ? `${upcoming} upcoming` : everInterviewed ? 'Done' : 'Not yet',
        },
        {
            key: 'hire', label: 'Offer & hire', to: '/company/offers',
            done: hired > 0,
            detail: hired ? `${hired} hired` : offersWaiting ? `${offersWaiting} offer out` : 'Not yet',
        },
    ];
    const currentIdx = steps.findIndex((s) => !s.done && !s.attention);
    if (currentIdx >= 0) steps[currentIdx].current = true;

    // The single most useful thing to do right now, most urgent first.
    let next;
    if (unpaidJobs) {
        const one = unpaidJobs === 1 && dash?.pending_payment_job?.title;
        next = {
            tone: 'amber', icon: '💳', urgent: true,
            title: one ? `Pay ₹3,999 to publish "${dash.pending_payment_job.title}"` : `${plural(unpaidJobs, 'job is', 'jobs are')} waiting for payment`,
            text: 'The job goes live for candidates as soon as the payment clears. Platinum companies skip this fee.',
            cta: 'Pay and publish', to: '/company/jobs',
        };
    } else if (feeDue > 0) {
        next = {
            tone: 'amber', icon: '🧾', urgent: true,
            title: `${inr(feeDue)} placement fee to pay`,
            text: `${plural(feeInvoices, 'invoice is', 'invoices are')} open. You can pay in full or in part online.`,
            cta: 'Open payments', to: '/company/payments',
        };
    } else if (awaitingOutcome) {
        next = {
            tone: 'amber', icon: '📝', urgent: true,
            title: `Record the outcome of ${plural(awaitingOutcome, 'interview', 'interviews')}`,
            text: 'Mark each one selected, on hold or rejected. Selecting a candidate lets you request their offer letter.',
            cta: 'Record outcomes', to: '/company/interviews',
        };
    } else if (toReview) {
        next = {
            tone: 'amber', icon: '📥', urgent: true,
            title: `${plural(toReview, 'new application', 'new applications')} to review`,
            text: 'Best fits are listed first, with Premium candidates (⭐) on top. Shortlist the ones you like.',
            cta: 'Review candidates', to: '/company/shortlist', ai: 'Find candidates for my job',
        };
    } else if (offersWaiting) {
        next = {
            tone: 'blue', icon: '📨',
            title: `${plural(offersWaiting, 'offer is', 'offers are')} waiting for the candidate`,
            text: 'You will be notified as soon as they accept or decline.',
            cta: 'See offers', to: '/company/offers',
        };
    } else if (iv.next) {
        next = {
            tone: 'blue', icon: '🗓',
            title: `Interview: ${fmtWhen(iv.next.slot_datetime)}`,
            text: `${iv.next.job_title}, with ${iv.next.candidate_name}. Check the details and get ready.`,
            cta: 'See interview details', to: '/company/interviews',
        };
    } else if (!profileDone) {
        next = {
            tone: 'indigo', icon: '🏢',
            title: 'Finish your company profile',
            text: 'Tell candidates who you are. It helps our team match the right people to your jobs.',
            cta: 'Complete profile', to: '/company/profile',
        };
    } else if (activeJobs === 0) {
        next = {
            tone: 'indigo', icon: '💼',
            title: 'Post your first job',
            text: 'Each job is ₹3,999 to go live (free on Platinum). Our executives then source matching candidates for it.',
            cta: 'Post a job', to: '/company/jobs', ai: 'Draft a job post',
        };
    } else if (shortlisted > 0) {
        next = {
            tone: 'indigo', icon: '🗓',
            title: `${plural(shortlisted, 'candidate is', 'candidates are')} shortlisted`,
            text: 'Request interviews and our executive will set up the slots with them.',
            cta: 'Request interviews', to: '/company/interviews',
        };
    } else if (hired > 0) {
        next = {
            tone: 'green', icon: '🎉',
            title: `You've hired ${plural(hired, 'person', 'people')}`,
            text: 'Post another job to keep growing, or browse the talent pool.',
            cta: 'Browse talent pool', to: '/company/talent', ai: 'Find candidates for my job',
        };
    } else {
        next = {
            tone: 'indigo', icon: '👥',
            title: totalApps ? `${plural(totalApps, 'application', 'applications')} so far` : 'Find candidates for your jobs',
            text: 'Browse the talent pool ranked by fit, and express interest in the people you like.',
            cta: 'Open talent pool', to: '/company/talent', ai: 'Find candidates for my job',
        };
    }

    return {
        steps, next,
        counts: { jobs: unpaidJobs, shortlist: toReview, interviews: awaitingOutcome, payments: feeInvoices },
    };
};
