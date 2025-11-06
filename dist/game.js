var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Game {
    constructor() {
        this.isGuessing = false;
        this.isWin = false;
        this.text = '';
        this.mainSuggestion = null;
        this.bestScore = 2;
        this.guesses = [];
        this.guessChunkSet = new Set();
        this.guessIDSet = new Set();
        this.guessCount = 0;
    }
}
function tempToColor(value, elemType) {
    // const clamped = Math.max(0, Math.min(2, value));
    const clamped = value > 1 ? 1 : value;
    const border_colors = [
        'border-orange-800/60',
        'border-orange-700/60',
        'border-orange-600/60',
        'border-orange-500/60',
        'border-orange-400/60',
        'border-orange-300/60',
        'border-sky-600/60',
        'border-sky-700/60'
    ];
    const background_colors = [
        'bg-orange-800/60',
        'bg-orange-700/60',
        'bg-orange-600/60',
        'bg-orange-500/60',
        'bg-orange-400/60',
        'bg-orange-300/60',
        'bg-sky-600/60',
        'bg-sky-700/60'
    ];
    const palette = elemType === 'border' ? border_colors : background_colors;
    const idx = Math.round(clamped * (palette.length - 1));
    return palette[idx];
}
function tempToProgress(score) {
    const clamped = score > 1 ? 1 : score;
    const widths = [
        'w-[100%]',
        'w-[95%]',
        'w-[90%]',
        'w-[85%]',
        'w-[80%]',
        'w-[75%]',
        'w-[70%]',
        'w-[65%]',
        'w-[60%]',
        'w-[55%]',
        'w-[50%]',
        'w-[45%]',
        'w-[40%]',
        'w-[35%]',
        'w-[30%]',
        'w-[25%]',
        'w-[20%]',
        'w-[15%]',
        'w-[10%]',
        'w-[5%]'
    ];
    const idx = Math.round(clamped * (widths.length - 1));
    return widths[idx];
}
function addCardListeners() {
    document.querySelectorAll('[data-card]').forEach(card => {
        const title = card.querySelector('.card-title');
        const scoreEl = card.querySelector('.card-score');
        const shortEl = card.querySelector('.short');
        const fullEl = card.querySelector('.full');
        const wikiBtn = card.querySelector('.wiki-btn');
        if (!shortEl || !fullEl || !title || !scoreEl || !wikiBtn) {
            return;
        }
        card.addEventListener('click', () => {
            const expanded = card.classList.toggle('expanded');
            shortEl.classList.toggle('hidden');
            fullEl.classList.toggle('hidden');
            title.classList.toggle('text-md', expanded);
            scoreEl.classList.toggle('text-md', expanded);
            wikiBtn.classList.toggle('hidden', !expanded);
        });
    });
}
function trimText(text) {
    let max_len = 25;
    let trimmed = text.slice(0, max_len);
    if (text.length > trimmed.length) {
        trimmed = trimmed + '...';
    }
    return trimmed;
}
function renderSuggestionButtonHTML(row) {
    return `
        <button id="${row.article_id}" class="chip activeButton">
            ${trimText(row.title)}
        </button>
    `;
}
function addSuggestionButtonListeners() {
    document.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            loadGuess(chip.id);
        });
    });
}
function addMainSuggestionListener() {
    const mainSuggestionElem = document.getElementById('mainSuggestion');
    if (!mainSuggestionElem)
        return;
    mainSuggestionElem.addEventListener('click', () => {
        if (game.mainSuggestion === null)
            return;
        loadGuess(String(game.mainSuggestion.article_id));
    });
}
function loadSuggestionButtons(suggestions) {
    return __awaiter(this, void 0, void 0, function* () {
        const mainSuggestionText = document.getElementById('mainSuggestionText');
        if (!mainSuggestionText)
            return;
        const input = mainSuggestionText.innerHTML.toUpperCase();
        if (input === '')
            return;
        let limit = 2;
        if (window.innerWidth > 700) {
            limit = 3;
        }
        const buttons = suggestions
            .slice(0, limit)
            .map((row) => renderSuggestionButtonHTML(row))
            .join('');
        updateInnerHTML('suggestionBox', buttons);
        addSuggestionButtonListeners();
    });
}
function loadEmptySuggestions() {
    game.mainSuggestion = null;
    updateInnerHTML('suggestionBox', `
        <button class="chip" style="border: 1px solid #ffa2a2; color: #ffa2a2;">No matching articles.</button>
    `);
}
function loadDefaultSuggestion(message) {
    const mainSuggestionElem = document.getElementById('mainSuggestion');
    if (!mainSuggestionElem)
        return;
    mainSuggestionElem.classList.add('text-gray-500/60', 'bg-[rgba(30,41,59,0.4)]', 'border', 'border-[#475569]');
    updateInnerHTML('suggestionBox', `
        <button class="chip">${message}</button>
    `);
}
function urlToName(title) {
    const titleSplit = title.split('/wiki/');
    return titleSplit[titleSplit.length - 1];
}
function loadWikiImage(url, targetID, title) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        addClasses(targetID, ['hidden']);
        removeClasses('imageSkeleton', ['hidden']);
        const defaultImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Wikipedia-logo-v2-square.svg/1024px-Wikipedia-logo-v2-square.svg.png';
        const targetImage = document.getElementById(targetID);
        if (!targetImage || !(targetImage instanceof HTMLImageElement))
            return;
        try {
            const name = urlToName(url);
            const imageURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${name}`;
            const res = yield fetch(imageURL, { headers: { 'Accept': 'application/json' } });
            if (!res.ok)
                return defaultImage;
            const data = yield res.json();
            const image = ((_a = data.originalimage) === null || _a === void 0 ? void 0 : _a.source) || defaultImage;
            targetImage.src = image;
            targetImage.alt = title;
        }
        catch (error) {
            console.error(error);
            targetImage.src = defaultImage;
            targetImage.alt = 'Wikipedia logo.';
            return defaultImage;
        }
        finally {
            removeClasses(targetID, ['hidden']);
            addClasses('imageSkeleton', ['hidden']);
        }
    });
}
function distanceToPercentage(distance) {
    const clampedDistance = distance > 1 ? 1 : distance;
    return (100 * (1 - clampedDistance)).toFixed(0);
}
function renderCardHTML(row) {
    const borderColor = tempToColor(row.distance, 'border');
    return `
        <article data-card
            class="
                relative bg-slate-800 border ${borderColor}
                rounded p-4 pt-5 text-sm leading-snug select-none
                break-all
            ">
            <span class="card-title absolute -top-2 left-2 bg-slate-900 px-1 text-xs font-bold uppercase">
                ${trimText(row.title)}
            </span>
            <span class="card-score absolute -top-2 right-2 bg-slate-900 px-1 text-xs font-bold">
                ${distanceToPercentage(row.distance)}%
            </span>

            <p>
                <span class="short">
                    ${row.chunk}
                </span>

                <span class="full hidden">
                    ${row.chunk}
                </span>
            </p>

            <a href="${row.url}" target="_blank">
                <button
                    class="wiki-btn hidden mt-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold text-xs px-3 py-1 rounded">
                    See on Wikipedia™
                </button>
            </a>
        </article>
    `;
}
function renderChunks() {
    const guessCards = game.guesses
        .slice(0, 100)
        .map((row) => renderCardHTML(row))
        .join('');
    updateInnerHTML('article-list', guessCards);
}
function renderIsGuessing() {
    updateInnerHTML('lastGuessText', '&nbsp;');
    updateInnerHTML('lastGuessTextMobile', '&nbsp;');
    updateInnerHTML('lastGuessDistance', '&nbsp;');
    updateInnerHTML('lastGuessDistanceMobile', '&nbsp;');
    addClasses('lastGuessImage', ['hidden']);
    removeClasses('imageSkeleton', ['hidden']);
    addClasses('lastGuessBox', [LOADING_CLASS]);
    addClasses('lastGuessBoxMobile', [LOADING_CLASS]);
    updateInnerHTML('lastGuessTopChunk', '');
    updateInnerHTML('mainSuggestionText', '');
    updateInnerHTML('mainSuggestionPrompt', '');
}
function renderEmptyState() {
    updateInnerHTML('lastGuessText', '&nbsp;');
    updateInnerHTML('lastGuessDistance', '&nbsp;');
    updateInnerHTML('lastGuessTextMobile', '&nbsp;');
    updateInnerHTML('lastGuessDistanceMobile', '&nbsp;');
    updateClassName('lastGuessBox', `
        flex flex-col items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-white-600 text-white
    `);
    updateClassName('lastGuessBoxMobile', `
        flex flex-row items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-white-600 text-white sm:hidden
    `);
    updateInnerHTML('mainSuggestionText', '');
    updateInnerHTML('mainSuggestionPrompt', '');
    removeClasses('lastGuessImage', ['hidden']);
    addClasses('imageSkeleton', ['hidden']);
}
function renderFailedGuess() {
    updateInnerHTML('lastGuessText', 'Error! please try again');
    updateInnerHTML('lastGuessDistance', '');
    updateInnerHTML('lastGuessTextMobile', 'Error! please try again');
    updateInnerHTML('lastGuessDistanceMobile', '');
    updateClassName('lastGuessBox', `
        flex flex-col items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-white-600 text-white
    `);
}
function cleanChunk(guess) {
    const guessCopy = Object.assign({}, guess);
    if (guessCopy.is_win) {
        guessCopy.distance = 0;
    }
    return guessCopy;
}
function renderGuess(chunks, guessCount, guessArticleId) {
    return __awaiter(this, void 0, void 0, function* () {
        chunks.sort((a, b) => a.distance - b.distance);
        const topChunk = chunks[0];
        updateInnerHTML('lastGuessText', topChunk.title);
        updateInnerHTML('lastGuessTextMobile', topChunk.title);
        updateInnerHTML('lastGuessTopChunk', topChunk.chunk.slice(0, 300));
        updateInnerHTML('lastGuessTopScore', `${distanceToPercentage(topChunk.distance)}%`);
        const lastGuessCard = document.getElementById('lastGuessCard');
        if (!lastGuessCard)
            return;
        for (const className of lastGuessCard.classList) {
            if (className.includes('border-'))
                lastGuessCard.classList.remove(className);
        }
        ;
        lastGuessCard.classList.add(tempToColor(topChunk.distance, 'border'));
        game.guessCount = guessCount;
        updateInnerHTML('guessCount', String(game.guessCount));
        if (suffixIsPlural(game.guessCount)) {
            updateInnerHTML("guessPlural", "es");
        }
        else {
            updateInnerHTML("guessPlural", "");
        }
        game.guessIDSet.add(guessArticleId);
        for (const guess of chunks) {
            if (game.guessChunkSet.has(guess.chunk_id))
                continue;
            game.guessChunkSet.add(guess.chunk_id);
            const cleanedGuess = cleanChunk(guess);
            game.guesses.push(cleanedGuess);
        }
        game.guesses.sort((a, b) => a.distance - b.distance);
        renderChunks();
        const displayDistance = distanceToPercentage(topChunk.distance);
        const guessDataTop = topChunk.distance;
        const borderColor = tempToColor(guessDataTop, 'border');
        const backgroundColor = tempToColor(guessDataTop, 'bg');
        for (const boxID of ['lastGuessBox', 'lastGuessBoxMobile']) {
            const lastGuessBox = document.getElementById(boxID);
            if (!lastGuessBox)
                return;
            const toRemove = [];
            for (const className of lastGuessBox.classList) {
                if (className.includes('bg-') || className.includes('border-')) {
                    toRemove.push(className);
                }
            }
            removeClasses(boxID, toRemove);
            addClasses(boxID, [borderColor, backgroundColor]);
            removeClasses(boxID, [LOADING_CLASS]);
        }
        updateInnerHTML('lastGuessDistance', `Score: ${displayDistance}%`);
        updateInnerHTML('lastGuessDistanceMobile', `Score: ${displayDistance}%`);
        if (window.innerWidth > 640) { // Tailwind sm
            loadWikiImage(topChunk.url, 'lastGuessImage', topChunk.title);
        }
        addCardListeners();
        game.bestScore = Math.min(game.bestScore, guessDataTop);
        const progress = tempToProgress(game.bestScore);
        updateClassName('progressBar', `${progress} ${tempToColor(game.bestScore, 'bg')}`);
        if (topChunk.is_win) {
            yield renderWin(topChunk.title.toUpperCase().trim(), topChunk.url);
        }
    });
}
function loadGuess(guessArticleId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (game.isWin)
            return;
        if (game.isGuessing)
            return;
        game.isGuessing = true;
        renderIsGuessing();
        const session_id = yield getSessionID();
        if (!session_id)
            return;
        const guessResponse = yield fetch(`${URI}/guess-article?article_id=${guessArticleId}&limit=10&session_id=${session_id}`);
        if (!guessResponse.ok) {
            renderFailedGuess();
            game.isGuessing = false;
            return;
        }
        const guessData = yield guessResponse.json();
        const guessCount = guessData.guesses;
        const chunks = guessData.chunks.map((chunk) => cleanChunk(chunk));
        yield renderGuess(chunks, guessCount, guessArticleId);
        game.mainSuggestion = null;
        game.isGuessing = false;
    });
}
function flagNoSuggestion() {
    const mainSuggestionElem = document.getElementById('mainSuggestion');
    if (!mainSuggestionElem)
        return;
    mainSuggestionElem.style.border = '1px solid #ffa2a2';
    mainSuggestionElem.style.color = '#ffa2a2';
    updateInnerHTML('mainSuggestionPrompt', '');
    loadEmptySuggestions();
}
function updateMainSuggestion() {
    return __awaiter(this, void 0, void 0, function* () {
        let mainSuggestionText = document.getElementById('mainSuggestionText');
        if (!mainSuggestionText)
            return;
        const input = mainSuggestionText.innerHTML.toUpperCase();
        if (input === '') {
            return loadDefaultSuggestion("Try guessing an article!");
        }
        const session_id = yield getSessionID();
        if (!session_id)
            return;
        const suggestionsResponse = yield fetch(encodeURI(`${URI}/suggestion?q=${input}&limit=4&session_id=${session_id}`));
        const suggestions = yield suggestionsResponse.json();
        if (suggestions.length === 0) {
            return flagNoSuggestion();
        }
        mainSuggestionText = document.getElementById('mainSuggestionText');
        if (!mainSuggestionText)
            return;
        const updatedInput = mainSuggestionText.innerHTML.toUpperCase();
        if (updatedInput !== input) {
            return;
        }
        const mainSuggestionElem = document.getElementById('mainSuggestion');
        if (!mainSuggestionElem)
            return;
        mainSuggestionElem.style.color = '#fff';
        mainSuggestionElem.style.border = `1px solid #475569`;
        game.mainSuggestion = suggestions[0];
        const topSuggestion = game.mainSuggestion.title.toUpperCase().trim();
        let topSuggestionPostfix = topSuggestion.replace(input.trim(), '');
        if (topSuggestionPostfix.length !== 0 &&
            topSuggestionPostfix[0] === ' ' &&
            input.length !== 0 &&
            input[input.length - 1] === ' ') {
            topSuggestionPostfix = topSuggestionPostfix.trim();
        }
        updateInnerHTML('mainSuggestionPrompt', trimText(topSuggestionPostfix));
        if (suggestions.length > 1) {
            loadSuggestionButtons(suggestions.slice(1, suggestions.length));
        }
        else if (suggestions.length === 1) {
            loadDefaultSuggestion("Only one match.");
        }
    });
}
function getMaxInputChars() {
    const width = window.innerWidth;
    if (width < 400) {
        return 15;
    }
    else if (width < 700) {
        return 18;
    }
    else {
        return 38;
    }
}
function handleBackspace() {
    updateInnerHTML('mainSuggestionPrompt', '');
    const mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText)
        return;
    const current = mainSuggestionText.innerText;
    mainSuggestionText.innerHTML = current.slice(0, current.length - 1);
    updateMainSuggestion();
}
function handleSpace() {
    const mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText)
        return;
    const text = mainSuggestionText.innerHTML;
    if (text.length > getMaxInputChars() ||
        text.length === 0 ||
        text.trim().length === 0 ||
        text[text.length - 1] === ' ')
        return;
    updateInnerHTML('mainSuggestionText', text + ' ');
    updateMainSuggestion();
}
function handleEnter() {
    if (game.mainSuggestion === null)
        return;
    loadGuess(String(game.mainSuggestion.article_id));
}
function handleOtherInput(value) {
    const mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText)
        return;
    const text = mainSuggestionText.innerHTML;
    if (text.length > getMaxInputChars())
        return;
    mainSuggestionText.innerHTML = text + value;
    updateMainSuggestion();
}
function addButtonListeners() {
    document.addEventListener('keydown', (e) => {
        e.preventDefault();
        if (game.isGuessing)
            return;
        if (e.key === 'Backspace') {
            handleBackspace();
        }
        else if (e.key === ' ') {
            handleSpace();
        }
        else if (e.key === 'Enter') {
            handleEnter();
        }
        else if (!acceptedKeys.has(e.key.toUpperCase())) {
            return;
        }
        else {
            handleOtherInput(e.key);
        }
    });
    const keys = document.querySelectorAll('.key');
    for (const key of keys) {
        key.addEventListener('click', () => {
            var _a;
            if (game.isGuessing)
                return;
            const value = (_a = key.textContent) !== null && _a !== void 0 ? _a : '';
            if (value === 'Back') {
                handleBackspace();
            }
            else if (value === 'Enter') {
                handleEnter();
            }
            else if (value === 'Space') {
                handleSpace();
            }
            else {
                handleOtherInput(value);
            }
        });
    }
}
function updateDailyNumber() {
    const MILLISECONDS_PER_DAY = 24 * 3600 * 1000;
    const GAME_EPOCH = 20287;
    const dayStartEasternMilli = getDayStartEasternMilli();
    const index = Math.floor(dayStartEasternMilli / MILLISECONDS_PER_DAY) - GAME_EPOCH;
    updateInnerHTML('dailyNumber', String(index));
}
function getDayStartEasternMilli() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const dateString = formatter.format(now);
    const [year, month, day] = dateString.split("-").map(Number);
    const midnightET = new Date(Date.UTC(year, month - 1, day));
    const offsetMinutes = -midnightET.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).includes("EST") ? 300 : 240;
    return midnightET.getTime() + offsetMinutes * 60 * 1000;
}
function updateClassName(id, value) {
    const elem = document.getElementById(id);
    if (!elem) {
        return;
    }
    elem.className = value;
}
export function updateInnerHTML(id, value) {
    const elem = document.getElementById(id);
    if (!elem)
        return;
    elem.innerHTML = value;
}
function removeClasses(id, classes) {
    const elem = document.getElementById(id);
    if (!elem)
        return;
    for (const className of classes) {
        elem.classList.remove(className);
    }
}
function addClasses(id, classes) {
    const elem = document.getElementById(id);
    if (!elem)
        return;
    for (const className of classes) {
        elem.classList.add(className);
    }
}
function fetchSessionID() {
    return __awaiter(this, void 0, void 0, function* () {
        const suggestionsResponse = yield fetch(encodeURI(`${URI}/start-session`));
        if (!suggestionsResponse.ok)
            return null;
        return yield suggestionsResponse.json();
    });
}
function addResetButtonListener() {
    const button = document.getElementById("resetButton");
    if (!button)
        return;
    button.addEventListener('click', () => {
        resetPage();
    });
}
function resetPage() {
    localStorage.clear();
    location.reload();
}
function existsSession() {
    const cached_session_id = localStorage.getItem("session_id");
    const cached_session_start = localStorage.getItem("session_start");
    return cached_session_id !== null && cached_session_start !== null;
}
function existsExpiredSession() {
    const dayStartEasternMilli = getDayStartEasternMilli();
    const cached_session_id = localStorage.getItem("session_id");
    const cached_session_start = localStorage.getItem("session_start");
    return (cached_session_id !== null &&
        cached_session_start !== null &&
        Number(cached_session_start) <= dayStartEasternMilli);
}
function getSessionID() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (existsExpiredSession()) {
                resetPage();
                return null;
            }
            if (existsSession())
                return localStorage.getItem("session_id");
            localStorage.clear();
            const session_id = yield fetchSessionID();
            if (!session_id)
                return null;
            localStorage.setItem("session_id", session_id);
            localStorage.setItem("session_start", String(Date.now()));
            return session_id;
        }
        catch (error) {
            localStorage.clear();
        }
        return null;
    });
}
export function getDailyStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`${URI}/stats`);
        if (!response.ok)
            return null;
        return yield response.json();
    });
}
function renderWin(title, imageURL) {
    return __awaiter(this, void 0, void 0, function* () {
        updateClassName('progressBar', `h-full bg-orange-800/60 w-full`);
        updateInnerHTML('lastGuessDistance', `Score: 100%`);
        updateClassName('lastGuessBox', `
        flex flex-col items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-orange-800/60
        bg-orange-800/60 text-white
    `);
        updateInnerHTML('winModalGuessCount', String(game.guessCount));
        updateInnerHTML('winModalTitle', title);
        yield loadWikiImage(imageURL, 'winImage', title);
        const stats = yield getDailyStats();
        if (!stats || stats.win_count <= 1) {
            updateInnerHTML("winModalStatsDesc", "You're the first player to solve today's puzzle! 😮");
        }
        else {
            const mean_guesses = String(stats.mean_guesses_per_win.toFixed(0));
            updateInnerHTML("winModalStatsDesc", `
            The ${stats.win_count} people who solved today's puzzle won in <span class="font-bold text-white">${mean_guesses}</span> guesses on average.
        `);
        }
        const winModal = document.getElementById('winModal');
        if (!winModal) {
            console.error("Could not access win modal element.");
            return;
        }
        winModal.style.display = 'flex';
        winModal.addEventListener('click', () => {
            winModal.style.display = 'none';
        });
        game.isWin = true;
    });
}
function restoreSession(session_id) {
    return __awaiter(this, void 0, void 0, function* () {
        addClasses('lastGuessImage', ['hidden']);
        removeClasses('imageSkeleton', ['hidden']);
        const response = yield fetch(`${URI}/restore-session?session_id=${session_id}`);
        if (!response.ok)
            throw Error("Could not restore session");
        const session_update = yield response.json();
        if (session_update.last_guess_article_id === -1) {
            renderEmptyState();
            return;
        }
        ;
        yield renderGuess(session_update.chunks.map((chunk) => cleanChunk(chunk)), session_update.guesses, String(session_update.last_guess_article_id));
        removeClasses('lastGuessImage', ['hidden']);
        addClasses('imageSkeleton', ['hidden']);
    });
}
function initGame() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const cached_session_id = localStorage.getItem("session_id");
            game.isGuessing = true;
            if (!existsExpiredSession() && cached_session_id !== null) {
                renderIsGuessing();
                yield restoreSession(cached_session_id);
            }
            else {
                yield getSessionID();
                renderEmptyState();
            }
        }
        catch (error) {
            console.error(error);
        }
        finally {
            game.isGuessing = false;
        }
    });
}
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function suffixIsPlural(value) {
    return value !== 1;
}
const URI = 'https://api.paragraphle.com';
// const URI = 'http://localhost:8000';
const acceptedKeys = new Set();
for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    acceptedKeys.add(letter);
}
const WHITELIST_KEYS = [
    'Enter', 'Backspace', '.',
    ',', ':', '-',
    ' ', `'`, `"`,
    '(', ')', '+',
    '-', '_', '1',
    '2', '3', '4',
    '5', '6', '7',
    '8', '9', '0',
    '?', '!', ';'
];
for (const key of WHITELIST_KEYS) {
    acceptedKeys.add(key);
}
const LOADING_CLASS = 'animate-[loadingBox_0.5s_linear_infinite_alternate]';
addCardListeners();
addButtonListeners();
updateDailyNumber();
addMainSuggestionListener();
addResetButtonListener();
let game = new Game();
initGame();
