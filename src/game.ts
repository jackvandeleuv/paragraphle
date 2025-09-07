interface Suggestion {
    article_id: number;
    title: string;
}

interface Chunk {
    chunk_id: number;
    chunk: string;
    distance: number;
    title: string;
    url: string;
    is_win: boolean;
}

interface SessionUpdate {
    chunks: Chunk[];
    guesses: number;
    last_guess_article_id: number;
}

interface Stats {
    current_users: number;
	mean_guesses_per_win: number;
    win_count: number;
}

class Game {
    isGuessing: boolean;
    isWin: boolean;
    text: string;
    mainSuggestion: Suggestion | null;
    bestScore: number;
    guesses: Chunk[];
    guessChunkSet: Set<number>;
    guessIDSet: Set<string>;
    guessCount: number;

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

function tempToColor(value: number, elemType: string) {
    const clamped = Math.max(0, Math.min(2, value));

    let palette = [];
    if (elemType === 'border') {
        palette = [
            'border-orange-800/60',
            'border-orange-700/60',
            'border-orange-600/60',
            'border-orange-500/60',
            'border-orange-400/60',
            'border-orange-300/60',
            'border-sky-600/60',
            'border-sky-600/60',
            'border-sky-600/60',
            'border-sky-600/60',
            'border-sky-700/60',
            'border-sky-700/60',
            'border-sky-700/60',
            'border-sky-700/60',
            'border-sky-700/60',
            'border-sky-700/60',
            'border-sky-700/60',
            'border-sky-700/60',
            'border-sky-700/60'
        ];
    } else {
        palette = [
            'bg-orange-800/60',
            'bg-orange-700/60',
            'bg-orange-600/60',
            'bg-orange-500/60',
            'bg-orange-400/60',
            'bg-orange-300/60',
            'bg-sky-600/60',
            'bg-sky-600/60',
            'bg-sky-600/60',
            'bg-sky-600/60',
            'bg-sky-700/60',
            'bg-sky-700/60',
            'bg-sky-700/60',
            'bg-sky-700/60',
            'bg-sky-700/60',
            'bg-sky-700/60',
            'bg-sky-700/60',
            'bg-sky-700/60',
            'bg-sky-700/60'
        ];
    }

    const idx = Math.round((clamped / 2) * (palette.length - 1));
    return palette[idx];
}

function tempToProgress(score: number) {
    const progress = Math.max(0, 1 - Math.pow(score, 1.5));
    const widths = [
        'w-[5%]',
        'w-[10%]',
        'w-[15%]',
        'w-[20%]',
        'w-[25%]',
        'w-[30%]',
        'w-[35%]',
        'w-[40%]',
        'w-[45%]',
        'w-[50%]',
        'w-[55%]',
        'w-[60%]',
        'w-[65%]',
        'w-[70%]',
        'w-[75%]',
        'w-[80%]',
        'w-[85%]',
        'w-[90%]',
        'w-[100%]' 
    ];

    const idx = Math.round(progress * (widths.length - 1)); 
    return widths[idx];
}

function addCardListeners() {
    document.querySelectorAll('[data-card]').forEach(card => {
        const title   = card.querySelector('.card-title');
        const scoreEl = card.querySelector('.card-score');
        const shortEl = card.querySelector('.short');
        const fullEl  = card.querySelector('.full');
        const wikiBtn = card.querySelector('.wiki-btn');
        if (!shortEl || !fullEl || !title || !scoreEl || !wikiBtn) {
            return 
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

function trimText(text: string) {
    let max_len = 25;
    let trimmed = text.slice(0, max_len);
    if (text.length > trimmed.length) {
        trimmed = trimmed + '...';
    }
    return trimmed;
}

function renderSuggestionButtonHTML(row: Suggestion) {
    return `
        <button id="${row.article_id}" class="chip activeButton">
            ${trimText(row.title)}
        </button>
    `;
}

function addSuggestionButtonListeners() {
    document.querySelectorAll<HTMLElement>('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            loadGuess(chip.id);
        });
    });  
}

function addMainSuggestionListener() {
    const mainSuggestionElem = document.getElementById('mainSuggestion')
    if (!mainSuggestionElem) return 
    mainSuggestionElem.addEventListener('click', () => {
        if (game.mainSuggestion === null) return;
        loadGuess(String(game.mainSuggestion.article_id));
    });
}

async function loadSuggestionButtons(suggestions: Suggestion[]) {
    const mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText) return;
    const input = mainSuggestionText.innerHTML.toUpperCase();
    if (input === '') return;

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
}

function loadEmptySuggestions() {
    game.mainSuggestion = null;
    updateInnerHTML('suggestionBox', `
        <button class="chip" style="border: 1px solid #ffa2a2; color: #ffa2a2;">No matching articles.</button>
    `);
}

function loadDefaultSuggestion(message: string) {
    const mainSuggestionElem = document.getElementById('mainSuggestion');
    if (!mainSuggestionElem) return;
    mainSuggestionElem.classList.add(
        'text-gray-500/60',
        'bg-[rgba(30,41,59,0.4)]',
        'border',
        'border-[#475569]'
    );
    updateInnerHTML('suggestionBox', `
        <button class="chip">${message}</button>
    `);
}

function urlToName(title: string) {
    const titleSplit = title.split('/wiki/');
    return titleSplit[titleSplit.length - 1];
}

async function loadWikiImage(url: string, targetID: string, title: string) {
    const defaultImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Wikipedia-logo-v2-square.svg/1024px-Wikipedia-logo-v2-square.svg.png';
    const targetImage = document.getElementById(targetID);
    if (!targetImage || !(targetImage instanceof HTMLImageElement)) return;
    try {
        const name = urlToName(url);
        const imageURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${name}`;
        const res = await fetch(imageURL, {headers: {'Accept': 'application/json'}});
        if (!res.ok) return defaultImage;
        const data = await res.json();
        const image = data.originalimage?.source || defaultImage;
        targetImage.src = image;
        targetImage.alt = title;
    } catch (error) {
        console.error(error);
        targetImage.src = defaultImage;
        targetImage.alt = 'Wikipedia logo.';
        return defaultImage;
    }
}

function renderCardHTML(row: Chunk) {
    const borderColor = tempToColor(row.distance, 'border');
    return `
        <article data-card
            class="
                relative bg-slate-800 border ${borderColor}
                rounded p-4 pt-5 text-sm leading-snug select-none
            ">
            <span class="card-title absolute -top-2 left-2 bg-slate-900 px-1 text-xs font-bold uppercase">
                ${trimText(row.title)}
            </span>
            <span class="card-score absolute -top-2 right-2 bg-slate-900 px-1 text-xs font-bold">
                ${row.distance.toFixed(2)}
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
    updateInnerHTML('lastGuessDistance', '&nbsp;');
    updateClassName('lastGuessBox', `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-slate-700
        bg-slate-700 text-slate-700 animate-[loadingBox_0.5s_linear_infinite_alternate]
    `);
    updateInnerHTML('mainSuggestionText', '');
    updateInnerHTML('mainSuggestionPrompt', '');
}

function renderEmptyState() {
    updateInnerHTML('lastGuessText', '&nbsp;');
    updateInnerHTML('lastGuessDistance', '&nbsp;');
    updateClassName('lastGuessBox', `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-white-600 text-white
    `);
    updateInnerHTML('mainSuggestionText', '');
    updateInnerHTML('mainSuggestionPrompt', '');
}

function renderFailedGuess() {
    updateInnerHTML('lastGuessText', 'Error! please try again');
    updateInnerHTML('lastGuessDistance', '');
    updateClassName('lastGuessBox', `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-white-600 text-white
    `);
}

async function renderGuess(chunks: Chunk[], guessCount: number, guessArticleId: string, session_id: string) {
    chunks.sort((a, b) => a.distance - b.distance);
    updateInnerHTML('lastGuessText', chunks[0].title);
    
    game.guessCount = guessCount;
    updateInnerHTML('guessCount', String(game.guessCount));

    if (suffixIsPlural(game.guessCount)) {
        updateInnerHTML("guessPlural", "es")
    } else {
        updateInnerHTML("guessPlural", "")
    }

    game.guessIDSet.add(guessArticleId);

    for (const guess of chunks) {
        if (game.guessChunkSet.has(guess.chunk_id)) continue;
        game.guessChunkSet.add(guess.chunk_id);
        game.guesses.push(guess);
    }
    game.guesses.sort((a, b) => a.distance - b.distance);
    renderChunks();

    const displayDistance = chunks[0].distance.toFixed(2);
    const guessDataTop = chunks[0].distance;
    const borderColor = tempToColor(guessDataTop, 'border');
    const backgroundColor = tempToColor(guessDataTop, 'bg');

    updateClassName('lastGuessBox', `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border ${borderColor} 
        ${backgroundColor} text-white
    `);
    updateInnerHTML('lastGuessDistance', `Distance: ${displayDistance}`);

    if (window.innerWidth > 700) {
        loadWikiImage(chunks[0].url, 'lastGuessImage', chunks[0].title);
        updateClassName('lastGuessImage', 'absolute w-full h-full object-cover z-[-1] opacity-[.07]');
    }

    addCardListeners();

    game.bestScore = Math.min(game.bestScore, guessDataTop);
    const progress = tempToProgress(game.bestScore);
    
    updateClassName('progressBar', `h-full ${progress} ${tempToColor(game.bestScore, 'bg')}`);   

    if (chunks[0].is_win) {
        await renderWin(chunks[0].title.toUpperCase().trim(), chunks[0].url);
    }
}

async function loadGuess(guessArticleId: string) {
    if (game.isWin) return;
    if (game.isGuessing) return;

    game.isGuessing = true;

    renderIsGuessing();

    const session_id = await getSessionID();
    if (!session_id) return;

    const guessResponse = await fetch(`${URI}/guess-article?article_id=${guessArticleId}&limit=10&session_id=${session_id}`);
    if (!guessResponse.ok) {
        renderFailedGuess();
        game.isGuessing = false;
        return;
    }

    const guessData = await guessResponse.json() as SessionUpdate;
    const guessCount = guessData.guesses;
    const chunks = guessData.chunks;

    await renderGuess(chunks, guessCount, guessArticleId, session_id);

    game.mainSuggestion = null;
    game.isGuessing = false;
}

export async function checkPlayerCount() {
    const stats = await getDailyStats();
    if (!stats) return;
    updateInnerHTML('playerCount', String(stats.current_users));
}

function flagNoSuggestion() {
    const mainSuggestionElem = document.getElementById('mainSuggestion')
    if (!mainSuggestionElem) return;
    mainSuggestionElem.style.border = '1px solid #ffa2a2';
    mainSuggestionElem.style.color = '#ffa2a2';
    updateInnerHTML('mainSuggestionPrompt', '');
    loadEmptySuggestions();
}

async function updateMainSuggestion() {
    let mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText) return;
    const input = mainSuggestionText.innerHTML.toUpperCase();
    if (input === '') {
        return loadDefaultSuggestion("Try guessing an article!");
    }

    const session_id = await getSessionID();
    if (!session_id) return;

    const suggestionsResponse = await fetch(encodeURI(`${URI}/suggestion?q=${input}&limit=4&session_id=${session_id}`));
    const suggestions = await suggestionsResponse.json() as Suggestion[];

    if (suggestions.length === 0) {
        return flagNoSuggestion();
    }

    mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText) return;
    const updatedInput = mainSuggestionText.innerHTML.toUpperCase();
    if (updatedInput !== input) {
        return 
    }

    const mainSuggestionElem = document.getElementById('mainSuggestion');
    if (!mainSuggestionElem) return;
    mainSuggestionElem.style.color = '#fff';
    mainSuggestionElem.style.border = `1px solid #475569`;
    
    game.mainSuggestion = suggestions[0];
    const topSuggestion = game.mainSuggestion.title.toUpperCase().trim();
    let topSuggestionPostfix = topSuggestion.replace(input.trim(), '');
    if (
        topSuggestionPostfix.length !== 0 && 
        topSuggestionPostfix[0] === ' ' &&
        input.length !== 0 &&
        input[input.length - 1] === ' '
    ) {
        topSuggestionPostfix = topSuggestionPostfix.trim()

    }
   updateInnerHTML('mainSuggestionPrompt', trimText(topSuggestionPostfix));

    if (suggestions.length > 1) {
        loadSuggestionButtons(suggestions.slice(1, suggestions.length));
    } else if (suggestions.length === 1) {
        loadDefaultSuggestion("Only one match.")
    }
}

function getMaxInputChars() {
    const width = window.innerWidth;
    if (width < 400) {
        return 15
    } else if (width < 700) {
        return 18
    } else {
        return 38
    }
}

function handleBackspace() {
    updateInnerHTML('mainSuggestionPrompt', '');
    const mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText) return;
    const current = mainSuggestionText.innerText;
    mainSuggestionText.innerHTML = current.slice(0, current.length - 1);
    updateMainSuggestion();
}

function handleSpace() {
    const mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText) return;
    const text = mainSuggestionText.innerHTML;
    if (
        text.length > getMaxInputChars() || 
        text.length === 0 ||
        text.trim().length === 0 ||
        text[text.length - 1] === ' '
    ) return;
    updateInnerHTML('mainSuggestionText', text + ' ');
    updateMainSuggestion();
}

function handleEnter() {
    if (game.mainSuggestion === null) return;
    loadGuess(String(game.mainSuggestion.article_id));
}

function handleOtherInput(value: string) {
    const mainSuggestionText = document.getElementById('mainSuggestionText');
    if (!mainSuggestionText) return;
    const text = mainSuggestionText.innerHTML;
    if (text.length > getMaxInputChars()) return;
    mainSuggestionText.innerHTML = text + value;
    updateMainSuggestion();
}

function addButtonListeners() {
    document.addEventListener('keydown', (e) => {
        e.preventDefault();

        if (game.isGuessing) return
        if (e.key === 'Backspace') {
            handleBackspace()
        } else if (e.key === ' ') {
            handleSpace()
        } else if (e.key === 'Enter') {
            handleEnter()
        } else if (!acceptedKeys.has(e.key.toUpperCase())) {
            return;
        } else {
            handleOtherInput(e.key)
        }
    });

    const keys = document.querySelectorAll('.key');
    for (const key of keys) {
        key.addEventListener('click', () => {
            if (game.isGuessing) return;
            const value = key.textContent ?? '';
            if (value === 'Back') {
                handleBackspace()
            } else if (value === 'Enter') {
                handleEnter()
            } else if (value === 'Space') {
                handleSpace()
            } else {
                handleOtherInput(value)
            }
        })
    }
}

function updateDailyNumber() {
    const MILLISECONDS_PER_DAY = 24 * 3600 * 1000;
    const GAME_EPOCH = 20287;

    const dayStartEasternMilli = getDayStartEasternMilli();
    const index = Math.floor(dayStartEasternMilli / MILLISECONDS_PER_DAY) - GAME_EPOCH;
    updateInnerHTML('dailyNumber', String(index));
}

function getDayStartEasternMilli(): number {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const dateString = formatter.format(now); 
    const [year, month, day] = dateString.split("-").map(Number);

    const midnightET = new Date(
    Date.UTC(year, month - 1, day) 
    );

    const offsetMinutes = -midnightET.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).includes("EST") ? 300 : 240;
    return midnightET.getTime() + offsetMinutes * 60 * 1000;
}

function updateClassName(id: string, value: string) {
    const elem = document.getElementById(id);
    if (!elem) {
        return 
    }
    elem.className = value;
}

export function updateInnerHTML(id: string, value: string) {
    const elem = document.getElementById(id);
    if (!elem) {
        return 
    }
    elem.innerHTML = value;
}

async function fetchSessionID(): Promise<string | null> {
    const suggestionsResponse = await fetch(encodeURI(`${URI}/start-session`));
    if (!suggestionsResponse.ok) return null;
    return await suggestionsResponse.json() as string;
}

function addResetButtonListener() {
    const button = document.getElementById("resetButton");
    if (!button) return;
    button.addEventListener('click', () => {
        resetPage();
    });
}

function resetPage() {
    localStorage.clear();
    location.reload();
}

function existsSession(): boolean {
    const cached_session_id = localStorage.getItem("session_id");
    const cached_session_start = localStorage.getItem("session_start");
    return cached_session_id !== null && cached_session_start !== null
}

function existsExpiredSession(): boolean {
    const dayStartEasternMilli = getDayStartEasternMilli();
    const cached_session_id = localStorage.getItem("session_id");
    const cached_session_start = localStorage.getItem("session_start");
    return (
        cached_session_id !== null &&
        cached_session_start !== null &&
        Number(cached_session_start) <= dayStartEasternMilli
    )
}

async function getSessionID(): Promise<string | null> {
    try {
        if (existsExpiredSession()) {
            resetPage();
            return null;
        }
        if (existsSession()) return localStorage.getItem("session_id");

        localStorage.clear();

        const session_id = await fetchSessionID();
        if (!session_id) return null;
        
        localStorage.setItem("session_id", session_id);
        localStorage.setItem("session_start", String(Date.now()));

        return session_id
    } catch (error) {
        localStorage.clear();
    }
    return null
}

export async function getDailyStats(): Promise<Stats | null> {
    const response = await fetch(`${URI}/stats`);
    if (!response.ok) return null;
    return await response.json() as Stats;
}

async function renderWin(title: string, imageURL: string) {
    updateClassName('progressBar', `h-full bg-red-700/60 w-full`);   

    updateInnerHTML('lastGuessDistance', `Distance: 0`);

    updateClassName('lastGuessBox', `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-red-700/60
        bg-red-700/60 text-white
    `);

    updateInnerHTML('winModalGuessCount', String(game.guessCount));
    updateInnerHTML('winModalTitle', title);
    
    await loadWikiImage(imageURL, 'winImage', title);

    const stats = await getDailyStats();
    if (!stats || stats.win_count <= 1) {
        updateInnerHTML("winModalStatsDesc", "You're the first player to solve today's puzzle! 😮")
    } else if (stats.win_count === 2) {
        updateInnerHTML("winModalStatsDesc", "You're the second player to solve today's puzzle! 👏")
    } else {
        const mean_guesses = Math.floor(stats.mean_guesses_per_win) + 1;
        updateInnerHTML("winModalStatsDesc", `
            The ${stats.win_count} people who solved today's puzzle won in <span class="font-bold text-white">${mean_guesses}</span> guesses on average.
        `)
    }
    
    const winModal = document.getElementById('winModal');
    if (!winModal) {
        console.error("Could not access win modal element.");
        return;
    }

    winModal.style.display = 'flex'
    winModal.addEventListener('click', () => {
        winModal.style.display = 'none';
    })

    game.isWin = true;
}

async function restoreSession(session_id: string) {
    const response = await fetch(`${URI}/restore-session?session_id=${session_id}`);
    if (!response.ok) throw Error("Could not restore session");
    const session_update = await response.json() as SessionUpdate;
    if (session_update.last_guess_article_id === -1) {
        renderEmptyState();
        return;
    };
    await renderGuess(session_update.chunks, session_update.guesses, String(session_update.last_guess_article_id), session_id);
}

async function initGame() {
    try {
        const cached_session_id = localStorage.getItem("session_id");
        game.isGuessing = true;
        if (!existsExpiredSession() && cached_session_id !== null) {
            renderIsGuessing();
            await restoreSession(cached_session_id);
        } else {
            await getSessionID();
        }
    } catch (error) {
        console.error(error);
    } finally {
        game.isGuessing = false;
    }
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function suffixIsPlural(value: number): boolean {
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
    acceptedKeys.add(key)
}

addCardListeners();
addButtonListeners();
updateDailyNumber();
addMainSuggestionListener();
addResetButtonListener();

let game = new Game();
initGame();
