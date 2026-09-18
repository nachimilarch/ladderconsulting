const db = require('../config/db');

// A company is "activated" (may post jobs / access the Talent Pool) if it paid the
// flat listing fee OR moved to the Premium tier — these are alternative tracks, not
// additive; Premium replaces the listing-fee requirement rather than building on it.
const getCompanyAccess = async (companyId) => {
    const [[row]] = await db.query(
        'SELECT listing_fee_paid, company_tier FROM companies WHERE id = ? AND deleted_at IS NULL',
        [companyId]
    );
    const isPremium = row?.company_tier === 'premium';
    return {
        activated: !!row?.listing_fee_paid || isPremium,
        isPremium,
    };
};

module.exports = { getCompanyAccess };
