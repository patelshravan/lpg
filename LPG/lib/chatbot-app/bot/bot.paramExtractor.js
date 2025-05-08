export function extractParamsFromMessage(message) {
    const params = {};
    const lower = message.toLowerCase();

    // Extract date range like "from date 1 to 5"
    const dateRangeMatch = lower.match(/from date (\d+) to (\d+)/);
    if (dateRangeMatch) {
        params.startDate = parseInt(dateRangeMatch[1], 10);
        params.endDate = parseInt(dateRangeMatch[2], 10);
    }

    // Extract single date like "on date 3" or "for date 5"
    const singleDateMatch = lower.match(/(?:on|for) date (\d+)/);
    if (singleDateMatch && !params.startDate) {
        params.date = parseInt(singleDateMatch[1], 10);
    }

    // Extract new value for adjustment update
    const valueMatch = lower.match(/to (\d+(\.\d+)?)/);
    if (valueMatch) {
        params.value = parseFloat(valueMatch[1]);
    }

    // Extract source and target date for move nomination
    const moveMatch = lower.match(/from date (\d+) to date (\d+)/);
    if (moveMatch) {
        params.fromDate = parseInt(moveMatch[1], 10);
        params.toDate = parseInt(moveMatch[2], 10);
    }

    return params;
}
