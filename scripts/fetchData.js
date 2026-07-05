import { testGuess, URI } from "./config.js";
import { getDayStartEasternMilli } from "./utilities.js";

function existsSession() {
    const cached_session_id = localStorage.getItem("session_id");
    const cached_session_start = localStorage.getItem("session_start");
    return cached_session_id !== null && cached_session_start !== null
}

function existsExpiredSession() {
    const dayStartEasternMilli = getDayStartEasternMilli();
    const cached_session_id = localStorage.getItem("session_id");
    const cached_session_start = localStorage.getItem("session_start");
    return (
        cached_session_id !== null &&
        cached_session_start !== null &&
        Number(cached_session_start) <= dayStartEasternMilli
    )
}

async function fetchSessionID() {
    const suggestionsResponse = await fetch(encodeURI(`${URI}/start-session`));
    if (!suggestionsResponse.ok) return null;
    return await suggestionsResponse.json();
}

function resetPage() {
    console.error('NEED TO IMPLEMENT RESET PAGE')
}

export async function getSessionID() {
    try {
        if (existsExpiredSession()) {
            resetPage();
            return null;
        }
        if (existsSession()) return localStorage.getItem("session_id");

        localStorage.clear();

        const session_id = await fetchSessionID();
        console.log('session id')
        if (!session_id) return null;
        
        localStorage.setItem("session_id", session_id);
        localStorage.setItem("session_start", String(Date.now()));

        return session_id
    } catch (error) {
        console.error(error);
        localStorage.clear();
    }
    return null
}

export async function getSuggestions(input) {
    const sessionId = await getSessionID();
    const suggestionsResponse = await fetch(encodeURI(`${URI}/suggestion?q=${input}&limit=10&session_id=${sessionId}`));
    const suggestions = await suggestionsResponse.json();
    return suggestions;
}

export async function guessArticle(article_id) {
    if (!article_id) {
        console.error(`guessArticle is missing article_id.`);
        return;
    }
    const sessionId = await getSessionID();
    const guessResponse = await fetch(`${URI}/guess-article?article_id=${article_id}&limit=3&session_id=${sessionId}`);
    const responseJSON = await guessResponse.json();
    
    const chunks = responseJSON.chunks;
    console.log(chunks);
    chunks.sort((a, b) => a.distance - b.distance);
    responseJSON.chunks = chunks.slice(0, 3);
    return responseJSON;
}