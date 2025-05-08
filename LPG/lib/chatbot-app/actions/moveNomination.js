/**
 * Moves nomination data from one date to another in terminalData
 * Assumes `terminalData` is globally available or shared from a data module
 */

const terminalData = [
    { date: 1, nomination: 20 },
    { date: 2, nomination: 0 },
    { date: 3, nomination: 15 },
    { date: 4, nomination: 0 },
    { date: 5, nomination: 10 },
    // ... more if needed
];

export function moveNomination({ fromDate, toDate }) {
    if (fromDate == null || toDate == null) {
        return "Please provide both source and target dates.";
    }

    const from = terminalData.find((entry) => entry.date === fromDate);
    const to = terminalData.find((entry) => entry.date === toDate);

    if (!from) return `No data found for source date ${fromDate}.`;
    if (!to) return `No data found for target date ${toDate}.`;

    to.nomination += from.nomination;
    from.nomination = 0;

    return `Nomination successfully moved from date ${fromDate} to date ${toDate}.`;
}
