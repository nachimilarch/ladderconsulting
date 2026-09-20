// The candidate workflow in one place, so the stepper, the "next step" card and the
// checklist always agree: build a profile -> apply -> interview -> offer -> hired.

const INTERVIEW_STAGES = ['interview_scheduled', 'interviewed', 'offer_sent', 'hired'];

const fmtWhen = (d) =>
    new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const buildJourney = ({ hasResume, completeness, applications = [], interviews = [], offers = [] }) => {
    const live = applications.filter((a) => !['withdrawn', 'rejected'].includes(a.status));
    const pendingOffers = offers.filter((o) => o.offer_status === 'sent');
    const offerApp = applications.find((a) => a.status === 'offer_sent');
    const offerWaiting = pendingOffers[0]
        ? { company: pendingOffers[0].company_name, job: pendingOffers[0].job_title }
        : offerApp ? { company: offerApp.company_name, job: offerApp.title } : null;
    const offerCount = pendingOffers.length || (offerApp ? 1 : 0);
    const hired = applications.some((a) => a.status === 'hired');
    const needsConfirm = interviews.filter((i) => ['proposed', 'rescheduled'].includes(i.status) && !i.candidate_confirmed);
    const upcoming = interviews
        .filter((i) => ['proposed', 'confirmed', 'rescheduled'].includes(i.status) && new Date(i.slot_datetime) > new Date())
        .sort((a, b) => new Date(a.slot_datetime) - new Date(b.slot_datetime));

    const profileDone = hasResume && completeness >= 80;
    const applied = applications.length > 0;
    const interviewed = interviews.length > 0 || applications.some((a) => INTERVIEW_STAGES.includes(a.status));
    const offered = offers.length > 0 || applications.some((a) => ['offer_sent', 'hired'].includes(a.status));

    const flags = [profileDone, applied, interviewed, offered, hired];
    const current = flags.indexOf(false); // -1 when everything is done
    const steps = [
        { key: 'profile',   label: 'Profile',   detail: profileDone ? 'Ready' : `${completeness}% done`, to: '/candidate/profile' },
        { key: 'apply',     label: 'Apply',     detail: applied ? `${applications.length} applied` : 'Find jobs', to: '/candidate/jobs' },
        { key: 'interview', label: 'Interview', detail: upcoming.length ? `${upcoming.length} upcoming` : interviewed ? 'Done' : 'Not yet', to: '/candidate/interviews' },
        { key: 'offer',     label: 'Offer',     detail: offerCount ? `${offerCount} waiting` : offered ? 'Received' : 'Not yet', to: '/candidate/applications' },
        { key: 'hired',     label: 'Hired',     detail: hired ? 'Congratulations!' : 'Not yet', to: '/candidate/applications' },
    ].map((s, i) => ({ ...s, done: flags[i], current: i === current }));

    // The single most useful thing to do right now, most urgent first.
    let next;
    if (hired) {
        next = { tone: 'green', icon: '🎉', title: "You're hired. Congratulations!", text: 'Your placement is complete. The LadderStep team will follow up with onboarding details.', cta: 'View my applications', to: '/candidate/applications' };
    } else if (offerWaiting) {
        next = { tone: 'amber', icon: '📩', urgent: true, title: `You have an offer from ${offerWaiting.company}`, text: `${offerWaiting.job}. Review it and accept or decline.`, cta: 'Review offer', to: '/candidate/applications' };
    } else if (needsConfirm.length) {
        const i = needsConfirm[0];
        next = { tone: 'amber', icon: '🗓', urgent: true, title: `Confirm your interview with ${i.company_name}`, text: `${i.job_title}, ${fmtWhen(i.slot_datetime)}. Confirm the slot so the company knows you'll be there.`, cta: 'Confirm interview', to: '/candidate/interviews' };
    } else if (upcoming.length) {
        const i = upcoming[0];
        next = { tone: 'blue', icon: '🗓', title: `Interview: ${fmtWhen(i.slot_datetime)}`, text: `${i.job_title} at ${i.company_name}. Check the details and get ready.`, cta: 'See interview details', to: '/candidate/interviews' };
    } else if (!hasResume) {
        next = { tone: 'indigo', icon: '📄', title: 'Upload your resume', text: 'It powers your job matches and fills in your profile for you.', cta: 'Upload resume', to: '/candidate/profile', ai: 'What should I improve on my profile?' };
    } else if (completeness < 80) {
        next = { tone: 'indigo', icon: '👤', title: `Finish your profile (${completeness}%)`, text: 'A complete profile gets you better job matches and more attention from companies.', cta: 'Complete profile', to: '/candidate/profile', ai: 'Polish my profile' };
    } else if (!applied) {
        next = { tone: 'indigo', icon: '🔍', title: 'Find jobs that fit you and apply', text: 'Your profile is ready. See roles ranked by how well they match your skills.', cta: 'Browse jobs', to: '/candidate/jobs', ai: 'Find jobs that match me' };
    } else {
        next = { tone: 'indigo', icon: '📋', title: `You've applied to ${live.length || applications.length} job${(live.length || applications.length) === 1 ? '' : 's'}`, text: 'Track where each one stands, and keep applying to widen your chances.', cta: 'Track applications', to: '/candidate/applications', ai: 'Find more matching jobs' };
    }

    return { steps, next, counts: { applications: applications.length, pendingOffers: offerCount, upcoming: upcoming.length, needsConfirm: needsConfirm.length }, nextInterview: upcoming[0] || null };
};

// What is still missing from a profile, each with where to fix it.
export const profileChecklist = ({ hasResume, skills, education, experience, completeness }) => [
    { label: 'Resume uploaded', done: hasResume },
    { label: 'Skills added', done: skills > 0, hint: `${skills} added` },
    { label: 'Education added', done: education > 0 },
    { label: 'Work experience', done: experience > 0, hint: experience > 0 ? `${experience} yrs` : null },
    { label: 'Profile 80% complete', done: completeness >= 80, hint: `${completeness}%` },
];
