import { adjustmentData } from "../data/adjustmentData.js";

export function resetAdjustments() {
    try {
        for (let key in adjustmentData) {
            if (Array.isArray(adjustmentData[key])) {
                adjustmentData[key] = adjustmentData[key].map(() => 0);
            }
        }
        return "✅ All adjustments have been reset to 0.";
    } catch (err) {
        console.error("❌ Reset Error:", err);
        return "Failed to reset adjustments.";
    }
}
