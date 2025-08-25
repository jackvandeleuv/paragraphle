function tempToColor(value, elemType) {
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

function tempToProgress(score) {
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
    document.querySelectorAll('.chip').forEach(card => {
        card.addEventListener('click', (e) => {
            loadGuess(e.target.id);
        })
    });    
}

function addMainSuggestionListener() {
    document.getElementById('mainSuggestion').addEventListener('click', () => {
        if (mainSuggestion === null) return;
        loadGuess(mainSuggestion.article_id);
    });
}

async function loadSuggestionButtons(suggestions) {
    const input = document.getElementById('mainSuggestionText').innerHTML.toUpperCase();
    if (input === '') return;

    let limit = 2;
    if (window.innerWidth > 700) {
        limit = 3;
    }

    const buttons = suggestions
        .slice(0, limit)
        .map((row) => renderSuggestionButtonHTML(row))
        .join('');
    document.getElementById('suggestionBox').innerHTML = buttons;
    addSuggestionButtonListeners();
}

function loadEmptySuggestions() {
    mainSuggestion = null;
    document.getElementById('suggestionBox').innerHTML = `
        <button class="chip" style="border: 1px solid #ffa2a2; color: #ffa2a2;">No matching articles.</button>
    `;
}

function loadDefaultSuggestion(message) {
    document.getElementById('mainSuggestion').classList.add(
        'text-gray-500/60',
        'bg-[rgba(30,41,59,0.4)]',
        'border',
        'border-[#475569]'
    );
    document.getElementById('suggestionBox').innerHTML = `
        <button class="chip">${message}</button>
    `;
}

function urlToName(title) {
    const titleSplit = title.split('/wiki/');
    return titleSplit[titleSplit.length - 1];
}

async function loadWikiImage(url, targetID, title) {
    const defaultImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Wikipedia-logo-v2-square.svg/1024px-Wikipedia-logo-v2-square.svg.png';
    try {
        const name = urlToName(url);
        const imageURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${name}`;
        const res = await fetch(imageURL, {headers: {'Accept': 'application/json'}});
        if (!res.ok) return defaultImage;
        const data = await res.json();
        const image = data.originalimage?.source || defaultImage;
        document.getElementById(targetID).src = image;
        document.getElementById(targetID).alt = title;
    } catch (error) {
        console.error(error);
        document.getElementById(targetID).src = defaultImage;
        document.getElementById(targetID).alt = 'Wikipedia logo.';
        return defaultImage;
    }
}

function renderCardHTML(row) {
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
                    See on Wikipedia
                </button>
            </a>
        </article>
    `;
}

function renderGuesses() {
    const guessCards = guesses
        .slice(0, 150)
        .map((row) => renderCardHTML(row))
        .join('');
    document.getElementById('article-list').innerHTML = guessCards;
}

async function loadGuess(guessArticleId) {
    if (isWin) return;
    if (isGuessing) return;
    isGuessing = true;

    document.getElementById('lastGuessText').innerHTML = '&nbsp;';
    document.getElementById('lastGuessDistance').innerHTML = '&nbsp;';
    document.getElementById('lastGuessBox').className = `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-slate-700
        bg-slate-700 text-slate-700 animate-[loadingBox_0.5s_linear_infinite_alternate]
    `;

    document.getElementById('mainSuggestionText').innerHTML = '';
    document.getElementById('mainSuggestionPrompt').innerHTML = '';

    const guessResponse = await fetch(`${URI}/guess-article?article_id=${guessArticleId}&limit=10&session_id=${SESSION_ID}`);
    if (!guessResponse.ok) {
        document.getElementById('lastGuessText').innerHTML = 'Error! please try again';
        document.getElementById('lastGuessDistance').innerHTML = '';
        document.getElementById('lastGuessBox').className = `
            mb-4 flex items-center justify-between text-sm md:text-base font-semibold
            px-3 py-1 rounded border border-white-600 text-white
        `;
        isGuessing = false;
        return;
    }

    const guessData = await guessResponse.json();

    guessData.sort((a, b) => a.distance - b.distance);
    document.getElementById('lastGuessText').innerHTML = guessData[0].title;
    
    if (!guessIDSet.has(guessArticleId)) {
        document.getElementById('guessCount').innerHTML = ++guessCount;
    }
    guessIDSet.add(guessArticleId);

    for (const guess of guessData) {
        if (guessChunkSet.has(guess.chunk_id)) continue;
        guessChunkSet.add(guess.chunk_id);
        guesses.push(guess);
    }
    guesses.sort((a, b) => a.distance - b.distance);
    renderGuesses();

    const displayDistance = guessData[0].distance.toFixed(2);
    const guessDataTop = guessData[0].distance;
    const borderColor = tempToColor(guessDataTop, 'border');
    const backgroundColor = tempToColor(guessDataTop, 'bg');

    document.getElementById('lastGuessBox').className = `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border ${borderColor} 
        ${backgroundColor} text-white
    `;
    document.getElementById('lastGuessDistance').innerHTML = `Distance: ${displayDistance}`;

    loadWikiImage(guessData[0].url, 'lastGuessImage', guessData[0].title);
    document.getElementById('lastGuessImage').className = 'absolute w-full h-full object-cover z-[-1] opacity-[.07]';

    addCardListeners();

    bestScore = Math.min(bestScore, guessDataTop);
    const progress = tempToProgress(bestScore);
    
    document.getElementById('progressBar').className = `h-full ${progress} ${tempToColor(bestScore, 'bg')}`;   

    if (guessData[0].is_win) {
        await renderWin(guessData[0].title.toUpperCase().trim(), guessData[0].url);
    }

    mainSuggestion = null;
    isGuessing = false;
}

function flagNoSuggestion() {
    document.getElementById('mainSuggestion').style.border = '1px solid #ffa2a2';
    document.getElementById('mainSuggestion').style.color = '#ffa2a2';
    document.getElementById('mainSuggestionPrompt').innerHTML = '';
    loadEmptySuggestions();
}

async function updateMainSuggestion() {
    const input = document.getElementById('mainSuggestionText').innerHTML.toUpperCase();
    if (input === '') {
        return loadDefaultSuggestion("Try guessing an article!");
    }

    const suggestionsResponse = await fetch(encodeURI(`${URI}/suggestion?q=${input}&limit=4&session_id=${SESSION_ID}`));
    const suggestions = await suggestionsResponse.json();

    if (suggestions.length === 0) {
        return flagNoSuggestion();
    }

    const updatedInput = document.getElementById('mainSuggestionText').innerHTML.toUpperCase();
    if (updatedInput !== input) {
        return 
    }

    document.getElementById('mainSuggestion').style.color = '#fff';
    document.getElementById('mainSuggestion').style.border = `1px solid #475569`;
    
    mainSuggestion = suggestions[0];
    const topSuggestion = mainSuggestion.title.toUpperCase().trim();
    let topSuggestionPostfix = topSuggestion.replace(input.trim(), '');
    if (
        topSuggestionPostfix.length !== 0 && 
        topSuggestionPostfix[0] === ' ' &&
        input.length !== 0 &&
        input[input.length - 1] === ' '
    ) {
        topSuggestionPostfix = topSuggestionPostfix.trim()

    }
    document.getElementById('mainSuggestionPrompt').innerHTML = trimText(topSuggestionPostfix);

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
    document.getElementById('mainSuggestionPrompt').innerHTML = '';
    const current = document.getElementById('mainSuggestionText').innerText;
    document.getElementById('mainSuggestionText').innerHTML = current.slice(0, current.length - 1);
    updateMainSuggestion();
}

function handleSpace() {
    const text = document.getElementById('mainSuggestionText').innerHTML;
    if (
        text.length > getMaxInputChars() || 
        text.length === 0 ||
        text.trim().length === 0 ||
        text[text.length - 1] === ' '
    ) return;
    document.getElementById('mainSuggestionText').innerHTML = text + ' ';
    updateMainSuggestion();
}

function handleEnter() {
    if (mainSuggestion === null) return;
    loadGuess(mainSuggestion.article_id);
}

function handleOtherInput(value) {
    const text = document.getElementById('mainSuggestionText').innerHTML;
    if (text.length > getMaxInputChars()) return;
    document.getElementById('mainSuggestionText').innerHTML = text + value;
    updateMainSuggestion();
}

function addButtonListeners() {
    document.addEventListener('keydown', (e) => {
        e.preventDefault();
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
        key.addEventListener('click', (e) => {
            const value = e.currentTarget.innerHTML;
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

function addDailyNumber() {
    const offsetTimestamp = Date.now() - (1000 * 3600 * 4);
    const index = Math.floor(offsetTimestamp / (1000 * 60 * 60 * 24)) - 20287;
    document.getElementById('dailyNumber').innerHTML = index;
}

async function renderWin(title, imageURL) {
    document.getElementById('progressBar').className = `h-full bg-red-700/60 w-full`;   

    document.getElementById('lastGuessDistance').innerHTML = `Distance: 0`;
    document.getElementById('lastGuessBox').className = `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-red-700/60
        bg-red-700/60 text-white
    `;

    document.getElementById('winModalGuessCount').innerHTML = guessCount;
    document.getElementById('winModalTitle').innerHTML = title;
    
    await loadWikiImage(imageURL, 'winImage', title);

    document.getElementById('winModal').style.display = 'flex'
    document.getElementById('winModal').addEventListener('click', () => {
        document.getElementById('winModal').style.display = 'none';
    })

    isWin = true;
}

const URI = 'https://api.paragraphle.com';
// const URI = 'http://localhost:8000';

let isGuessing = false;
let isWin = false;
let guessCount = 0;
let text = '';
let mainSuggestion;
let bestScore = 2;
const guesses = [];
const guessChunkSet = new Set();
const guessIDSet = new Set();
const SESSION_ID = Date.now();

const acceptedKeys = new Set();
for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    acceptedKeys.add(letter);
}

WHITELIST_KEYS = [
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
addDailyNumber();
addMainSuggestionListener();