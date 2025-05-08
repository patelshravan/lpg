/**
 * Simulates calculation of sum of terminal avails between startDate and endDate
 * Assumes `terminalData` is globally available or imported from another module
 */

const terminalData = [
    { date: 1, terminalAvails: 120 },
    { date: 2, terminalAvails: 130 },
    { date: 3, terminalAvails: 110 },
    { date: 4, terminalAvails: 150 },
    { date: 5, terminalAvails: 140 },
    // ...more if needed
];

export function calcTerminalAvails({ startDate, endDate }) {
    if (startDate == null || endDate == null) {
        return "Please specify both start and end dates.";
    }

    const filtered = terminalData.filter(
        (d) => d.date >= startDate && d.date <= endDate
    );

    const sum = filtered.reduce((acc, curr) => acc + (curr.terminalAvails || 0), 0);

    return `Sum of terminal avails from date ${startDate} to ${endDate} is ${sum}.`;
}
