const db = require('../config/db');

// Gate used by the AI chatbot endpoints (Phase 4) — an active OR grace-period
// subscription still has access; only 'suspended'/'cancelled'/missing does not.
const hasActiveAiSubscription = async (payerType, payerId) => {
    if (!payerId) return false;
    const column = payerType === 'candidate' ? 'candidate_id' : 'company_id';
    const [[row]] = await db.query(
        `SELECT status FROM ai_subscriptions WHERE ${column} = ? AND deleted_at IS NULL LIMIT 1`,
        [payerId]
    );
    return !!row && (row.status === 'active' || row.status === 'grace');
};

module.exports = { hasActiveAiSubscription };
