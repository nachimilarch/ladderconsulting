export const JOB_TYPE = { full_time: 'Full time', part_time: 'Part time', contract: 'Contract', internship: 'Internship' };
export const WORK_MODE = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' };

const lakhs = (v) => `₹${(Number(v) / 100000).toFixed(1).replace(/\.0$/, '')}L`;
export const salaryRange = (min, max) => {
    if (!min && !max) return null;
    if (min && max) return `${lakhs(min)} – ${lakhs(max)}`;
    return min ? `From ${lakhs(min)}` : `Up to ${lakhs(max)}`;
};
