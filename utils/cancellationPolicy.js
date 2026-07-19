const REFUND_POLICIES = {
    flexible: [
        { minHoursBefore: 24, refundPercent: 100 } // < 24h before check-in: 0% (falls through)
    ],
    moderate: [
        { minHoursBefore: 120, refundPercent: 100 }, // 5+ days before
        { minHoursBefore: 24,  refundPercent: 50 }   // 1-5 days before
        // < 24h before check-in: 0%
    ],
    strict: [
        { minHoursBefore: 168, refundPercent: 50 } // 7+ days before
        // < 7 days before check-in: 0%
    ]
};

export const getRefundPercent = (policy, checkInDate, now = new Date()) => {
    const tiers = REFUND_POLICIES[policy] || REFUND_POLICIES.moderate;
    const hoursUntilCheckIn = (new Date(checkInDate).getTime() - now.getTime()) / (1000 * 60 * 60);
    for (const tier of tiers) {
        if (hoursUntilCheckIn >= tier.minHoursBefore) return tier.refundPercent;
    }
    return 0;
};

export const POLICY_DESCRIPTIONS = {
    flexible: "Full refund if cancelled 24+ hours before check-in.",
    moderate: "Full refund 5+ days before check-in, 50% refund 1-5 days before, no refund within 24 hours.",
    strict:   "50% refund 7+ days before check-in, no refund within 7 days."
};