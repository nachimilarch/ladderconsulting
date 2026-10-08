// A candidate's own answer to "are you working or looking for a job?".
//   looking: actively searching
//   open:    employed, but open to the right offer
//   working: employed and not looking
// Only our own staff see it. It is never shown to companies (a candidate may not want their
// current employer to learn they are looking).

const STATUSES = ['looking', 'open', 'working'];

const LABELS = {
    looking: 'Looking for a job',
    open: 'Working, open to offers',
    working: 'Working, not looking',
};

const DEFAULT_REFRESH_DAYS = 30;

// Searching status goes stale quickly; "working, not looking" much more slowly.
const refreshDays = (status, baseDays = DEFAULT_REFRESH_DAYS) => (status === 'working' ? baseDays * 3 : baseDays);

const isValidStatus = (s) => STATUSES.includes(s);

module.exports = { STATUSES, LABELS, DEFAULT_REFRESH_DAYS, refreshDays, isValidStatus };
