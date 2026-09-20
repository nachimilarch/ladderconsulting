// Any button can open the AI assistant (optionally with a message to send for the
// user) through one DOM event: ChatbotWidget is mounted once per layout, so an event
// is simpler than threading context through every page.
export const OPEN_CHATBOT_EVENT = 'ladderstep:open-chatbot';

export const askAssistant = (text) => {
    window.dispatchEvent(new CustomEvent(OPEN_CHATBOT_EVENT, { detail: text ? { text } : {} }));
};
