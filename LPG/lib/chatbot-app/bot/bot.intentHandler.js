// export function extractIntentFromMessage(message) {
//     const msg = message.toLowerCase();

//     if (/^(hi|hello|hey|yo|what's up|sup)\b/.test(msg)) return "greet";
//     if (/(help|how to|what can you do|options)/.test(msg)) return "help";
//     if (/bye|goodbye|see you/.test(msg)) return "bye";
//     if (/generate.*pdf/.test(msg)) return "generate_pdf";
//     if (/terminal avails/.test(msg)) return "get_terminal_avails";
//     if (/violation.*days/.test(msg)) return "get_violation_days";
//     if (/update.*adjustment/.test(msg)) return "update_adjustment";
//     if (/closing inventory.*calculated/.test(msg)) return "calculate_closing_inventory";
//     if (/move.*nomination.*(from|to)/.test(msg)) return "move_nomination";

//     return "unknown";
// }

export function extractIntentFromMessage(message) {
    const lower = message.toLowerCase();

    if (["hi", "hello", "hey"].includes(lower)) return "greeting";
    if (lower.includes("hi lifty") || lower.includes("hello lifty")) return "greeting";
    if (lower.includes("bye") || lower.includes("goodbye") || lower.includes("see you")) return "bye";
    if (lower.includes("who are you") || lower.includes("who r u")) return "who_are_you";
    if (
        lower.includes("your job") ||
        lower.includes("what is your job") ||
        lower.includes("what do you do")
    ) return "job_description";
    if (
        lower.includes("how will you help") ||
        lower.includes("how can you help") ||
        lower.includes("how you can help") ||
        lower.includes("how do you help")
    ) return "how_help";

    return "unknown";
}

export function extractParamsFromMessage(message) {
    const params = {};
    const lowerMsg = message.toLowerCase();

    // Example: extract date from "on date 5th" or "to date 10"
    const dateMatch = lowerMsg.match(/date\s*(\d+)/);
    if (dateMatch) {
        params.date = parseInt(dateMatch[1], 10);
    }

    // Extract value like "to 100"
    const valMatch = lowerMsg.match(/to\s*(\d+)/);
    if (valMatch) {
        params.value = parseFloat(valMatch[1]);
    }

    // Product match
    const productMatch = lowerMsg.match(/\b(a-?\d{3})\b/i);
    if (productMatch) {
        params.field = productMatch[1].toUpperCase();
    }

    return params;
}

// export async function handleBotAction({ intent, params, data }) {
//     switch (intent) {
//         case "greet":
//             return "Hi there! 👋 How can I assist you today?";
//         case "help":
//             return "You can ask me things like:\n- Get terminal avails\n- Update adjustments\n- Generate PDF\n- Move nominations";
//         case "bye":
//             return "Goodbye! 👋 Have a great day!";
//         case "generate_pdf":
//             data.generatePDF?.();
//             return "✅ PDF generation triggered.";
//         case "get_terminal_avails":
//             return JSON.stringify(data?.liftingAmendmentData?.terminalAvails ?? {});
//         case "get_violation_days":
//             return handleViolationDays(data.liftingAmendmentData, params);
//         case "update_adjustment":
//             return updateAdjustment(data, params);
//         case "calculate_closing_inventory":
//             return calculateClosingInventory(data);
//         case "move_nomination":
//             return moveNominationDetail(data, params);
//         default:
//             return "Sorry, I didn't understand that.";
//     }
// }

export async function handleBotAction({ intent, params }) {
    switch (intent) {
        case "greeting":
            return "Hi there! 👋 How can I assist you today?";
        case "who_are_you":
            return "I'm Lifty, your assistant for lifting adjustments, inventory, and terminal data.";
        case "job_description":
            return "I'm here to help you view, update, or explain data related to lifting operations.";
        case "how_help":
            return "Ask me about terminal avails, adjustments, inventory, or request a PDF report!";
        case "bye":
            return "Goodbye! 👋 Have a great day!";
        default:
            return "🚧 This functionality is coming soon. Stay tuned!";
    }
}