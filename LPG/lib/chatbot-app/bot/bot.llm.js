let classifier = null;

const INTENTS = [
    'calculate_terminal_avails',
    'update_adjustments',
    'move_nomination',
    'generate_pdf',
    'reset_adjustments',
    'get_kpis'
];

export async function loadLLM() {
    while (!window.transformers || !window.transformers.ready) {
        await new Promise((resolve) => setTimeout(resolve, 50)); // wait until ready
    }

    if (!classifier) {
        classifier = await window.transformers.pipeline();
    }
}

export async function detectIntent(message) {
    if (!classifier) await loadLLM();

    const result = await classifier(message, INTENTS);
    return {
        intent: result.labels[0],
        confidence: result.scores[0].toFixed(2)
    };
}
