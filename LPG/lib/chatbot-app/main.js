import { loadLLM } from "./bot/bot.llm.js";
import { extractIntentFromMessage } from "./bot/bot.intentHandler.js";
import { extractParamsFromMessage } from "./bot/bot.paramExtractor.js";
import { handleBotAction } from "./bot/bot.intentHandler.js";

let inputInstance, sendButtonInstance;

window.addEventListener("DOMContentLoaded", async () => {
    // Disable launcher until model is loaded
    const launcher = document.getElementById("chat-launcher");
    launcher.style.opacity = 0.6;
    launcher.style.pointerEvents = "none";

    // Initialize DevExtreme TextArea and Button
    inputInstance = $("#chat-input").dxTextArea({
        placeholder: "Ask something...",
        stylingMode: "filled",
        height: 50,
        valueChangeEvent: "keyup",
        onKeyDown: function (e) {
            if (e.event.key === "Enter" && !e.event.shiftKey) {
                e.event.preventDefault();
                handleSend();
            }
        },
    }).dxTextArea("instance");

    sendButtonInstance = $("#chat-send").dxButton({
        icon: "fa fa-paper-plane",
        type: "default",
        stylingMode: "contained",
        onClick: handleSend,
    }).dxButton("instance");

    await loadLLM();

    // ✅ Re-enable launcher after model loads
    launcher.style.opacity = 1;
    launcher.style.pointerEvents = "auto";
    addMessage("bot", "Hi! 👋 I'm Lifty. Ask me anything about lifting adjustments, inventory, or terminal data.");
});

function disableInput() {
    inputInstance.option("disabled", true);
    sendButtonInstance.option("disabled", true);
}
function enableInput() {
    inputInstance.option("disabled", false);
    sendButtonInstance.option("disabled", false);
}

async function handleSend() {
    if (inputInstance.option("disabled") || sendButtonInstance.option("disabled")) return;

    const realInput = $(inputInstance.element()).find("textarea");
    const userInput = realInput.val().trim();
    if (!userInput) return toastr.warning("Please enter a message.");

    addMessage("user", userInput);
    inputInstance.option("value", "");
    showTyping();
    disableInput();

    const intent = extractIntentFromMessage(userInput);
    const params = extractParamsFromMessage(userInput);

    const response = await handleBotAction({
        intent,
        params,
        data: {
            liftingAmendmentData: window.liftingAmendmentData,
            updateLiftingGrid: window.updateLiftingGrid,
            generatePDF: window.generatePDF,
        },
    });

    hideTyping();
    addMessage("bot", response);
    enableInput();
}

function addMessage(sender, text) {
    const log = document.getElementById("chat-log");
    const msg = document.createElement("div");
    msg.className = `message ${sender}`;
    msg.innerText = text;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
}

function showTyping() {
    document.getElementById("typing-indicator").style.display = "block";
}
function hideTyping() {
    document.getElementById("typing-indicator").style.display = "none";
}
