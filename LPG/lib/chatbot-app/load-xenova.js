import { env, pipeline } from '../js/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;

env.localModelPath = '/LPG/lib/chatbot-app/models/';

(async () => {
    const loadedPipeline = await pipeline(
        'zero-shot-classification',
        'nli-deberta-v3-small'
    );

    window.transformers = {
        pipeline: () => loadedPipeline,
        ready: true
    };
})();
