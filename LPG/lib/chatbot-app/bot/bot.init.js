import { loadLLM } from "./bot.llm.js";
import { extractIntentFromMessage } from "./bot.intentHandler.js";
import { extractParamsFromMessage } from "./bot.paramExtractor.js";
import { handleBotAction } from "./bot.intentHandler.js";

export async function initializeBot(chatInputId, chatSendButtonId, progressDiv) {
    const inputInstance = $(chatInputId).dxTextArea("instance");
    const sendButtonInstance = $(chatSendButtonId).dxButton("instance");

    const llm = await loadLLM();

    async function handleSend() {
        if (inputInstance.option("disabled") || sendButtonInstance.option("disabled")) {
            return toastr.warning("Please wait for the bot to load.");
        }

        const userMessage = $(inputInstance.element()).find("textarea").val().trim();
        if (!userMessage) return toastr.warning("Please enter a message.");

        addMessage("User", userMessage);
        inputInstance.option("value", "");
        showTyping(progressDiv);

        const inputTokens = await llm.tokenizer.encode(userMessage);
        const intent = extractIntentFromMessage(userMessage, inputTokens);
        const params = extractParamsFromMessage(userMessage, inputTokens);

        const botReply = await handleBotAction({ intent, params });
        addMessage("Bot", botReply);

        hideTyping(progressDiv);
    }

    sendButtonInstance.option("onClick", handleSend);
}
