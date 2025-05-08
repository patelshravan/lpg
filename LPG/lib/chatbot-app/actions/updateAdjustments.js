/**
 * Updates the adjustment value on a specific date in terminalData
 * Assumes `terminalData` is globally available or shared from a data module
 */

const terminalData = [
    { date: 1, adjustment: 0 },
    { date: 2, adjustment: 0 },
    { date: 3, adjustment: 0 },
    { date: 4, adjustment: 0 },
    { date: 5, adjustment: 0 },
    // ... more if needed
];

export function updateAdjustments({ date, value }) {
    if (date == null || value == null) {
        return "Please provide both date and value to update the adjustment.";
    }

    const record = terminalData.find((entry) => entry.date === date);
    if (!record) {
        return `No entry found for date ${date}.`;
    }

    record.adjustment = value;
    return `Adjustment on date ${date} has been updated to ${value}.`;
}
