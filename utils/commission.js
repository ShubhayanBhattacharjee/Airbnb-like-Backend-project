export const getCommissionPercent = (home, host) => {
    if (home?.commissionOverridePercent != null) return home.commissionOverridePercent;
    if (host?.commissionOverridePercent != null) return host.commissionOverridePercent;
    return Number(process.env.PLATFORM_COMMISSION_PERCENT) || 10;
};