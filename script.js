function tempToColor(value) {
  const clamped = Math.max(0, Math.min(2, value));

  const palette = [
    'red-700',   
    'red-700',   
    'red-600',    
    'red-600',
    'orange-600',
    'amber-500',
    'amber-500', 
    'emerald-300', 
    'emerald-300',
    'emerald-300',  
    'emerald-300',
    'blue-400',     
    'blue-400', 
    'blue-400', 
    'blue-400', 
    'blue-400',
    'blue-400',
    'blue-600', 
    'blue-600', 
    'blue-600', 
    'blue-600', 
    'blue-600' 
  ];

  const idx = Math.round((clamped / 2) * (palette.length - 1));
  return palette[idx];
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

function loadDefaultSuggestion() {
    mainSuggestion = null;
    document.getElementById('mainSuggestion').classList.add(
        'text-gray-500/60',
        'bg-[rgba(30,41,59,0.4)]',
        'border',
        'border-[#475569]'
    );
    document.getElementById('suggestionBox').innerHTML = `
        <button class="chip">Try guessing an article!</button>
    `;
}


function renderCardHTML(row) {
    const color = tempToColor(row.distance);
    return `
        <article data-card
            class="
                relative bg-slate-700/30 border border-${color}/${highlightOpacity}
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

    document.getElementById('lastGuessText').innerHTML = '...';
    document.getElementById('lastGuessDistance').innerHTML = '...';
    document.getElementById('guessCount').innerHTML = ++guessCount;

    document.getElementById('mainSuggestionText').innerHTML = '';
    document.getElementById('mainSuggestionPrompt').innerHTML = '';

    const guessResponse = await fetch(`https://api.wiki-guess.com/guess_article/${guessArticleId}/limit/10`);
    const guessData = await guessResponse.json();

    guessData.sort((a, b) => a.distance - b.distance);
    document.getElementById('lastGuessText').innerHTML = guessData[0].title;

    for (const guess of guessData) {
        if (guessSet.has(guess.chunk_id)) continue;
        guessSet.add(guess.chunk_id);
        guesses.push(guess);
    }
    guesses.sort((a, b) => a.distance - b.distance);
    renderGuesses();

    const displayDistance = guessData[0].distance.toFixed(2);
    const guessDataTop = guessData[0].distance;
    const color = tempToColor(guessDataTop);

    document.getElementById('lastGuessBox').className = `
        mb-4 flex items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-${color}/${highlightOpacity} 
        bg-${color}/${highlightOpacity} text-white
    `;
    document.getElementById('lastGuessDistance').innerHTML = `Distance: ${displayDistance}`;

    addCardListeners();

    bestScore = Math.min(bestScore, guessDataTop)
    const progress = Math.round(Math.max(0, 100 - (100 * bestScore)))
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressBar').classList.add(`bg-${tempToColor(bestScore)}/${highlightOpacity}`);

    if (guessData[0].is_win) {
        renderWin();
    }

    mainSuggestion = null;
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
        return loadDefaultSuggestion();
    }

    document.getElementById('mainSuggestionPrompt').innerHTML = '...';

    const suggestionsResponse = await fetch(encodeURI(`https://api.wiki-guess.com/suggestion/${input}/limit/6`));
    const suggestionsJSON = await suggestionsResponse.json();
    const suggestions = suggestionsJSON.data;

    if (suggestions.length === 0 || !suggestionsJSON.has_match) {
        return flagNoSuggestion();
    }

    suggestions.sort((a, b) => b.count - a.count);

    document.getElementById('mainSuggestion').style.color = '#fff';
    document.getElementById('mainSuggestion').style.border = `1px solid #475569`;
    
    mainSuggestion = suggestions[0];
    const topSuggestion = mainSuggestion.title.toUpperCase().trim();
    const topSuggestionPostfix = topSuggestion.replace(input, '');
    document.getElementById('mainSuggestionPrompt').innerHTML = trimText(topSuggestionPostfix);

    if (suggestions.length > 1) {
        loadSuggestionButtons(suggestions.slice(1, suggestions.length));
    }
}

function addButtonListeners() {

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            document.getElementById('mainSuggestionPrompt').innerHTML = '';
            const current = document.getElementById('mainSuggestionText').innerText;
            document.getElementById('mainSuggestionText').innerHTML = current.slice(0, current.length - 1);
            updateMainSuggestion();
        } else if (e.key === 'Enter') {
            if (mainSuggestion === null) return;
            loadGuess(mainSuggestion.article_id);
        } else if (!acceptedKeys.has(e.key.toUpperCase())) {
            return;
        } else {
            const text = document.getElementById('mainSuggestionText').innerHTML;
            document.getElementById('mainSuggestionText').innerHTML = text + e.key;
            updateMainSuggestion();
        }
    });

    const keys = document.querySelectorAll('.key');
    for (const key of keys) {
        key.addEventListener('click', (e) => {
            const value = e.currentTarget.innerHTML;
            if (value === 'Back') {
                document.getElementById('mainSuggestionPrompt').innerHTML = '';
                const current = document.getElementById('mainSuggestionText').innerText;
                document.getElementById('mainSuggestionText').innerHTML = current.slice(0, current.length - 1);
                updateMainSuggestion();
            }
            else if (value === 'Enter') {
                if (mainSuggestion === null) return;
                loadGuess(mainSuggestion.article_id);
            } else if (value === 'Space') {
                const text = document.getElementById('mainSuggestionText').innerHTML;
                document.getElementById('mainSuggestionText').innerHTML = text + ' ';
                updateMainSuggestion();
            } else {
                const text = document.getElementById('mainSuggestionText').innerHTML;
                document.getElementById('mainSuggestionText').innerHTML = text + value;
                updateMainSuggestion();
            }
        })
    }
}

function addDailyNumber() {
    const offsetTimestamp = Date.now() - (1000 * 3600 * 4);
    const index = Math.floor(offsetTimestamp / (1000 * 60 * 60 * 24)) - 20287;
    document.getElementById('dailyNumber').innerHTML = index;
}

function addIntroModalListener() {
    document.getElementById('introModal').addEventListener('click', () => {
        document.getElementById('introModal').classList.add('hidden');
    })
}

function renderWin() {
    document.getElementById('progressBar').style.width = `100%`;
    document.getElementById('progressBar').classList.add(`bg-red-700/${highlightOpacity}`);
    document.getElementById('lastGuessDistance').innerHTML = `Distance: 0`;

    document.getElementById('winModalGuessCount').innerHTML = guessCount;
    document.getElementById('winModalTitle').innerHTML = mainSuggestion.title.toUpperCase().trim();
    
    document.getElementById('winModal').style.display = 'flex'
    document.getElementById('winModal').addEventListener('click', () => {
        document.getElementById('winModal').style.display = 'none';
    })

    isWin = true;
}

let isWin = false;
const highlightOpacity = 60;
let guessCount = 0;
let text = '';
let mainSuggestion;
let bestScore = 2;
const guesses = [];
const guessSet = new Set();

const acceptedKeys = new Set();
for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    acceptedKeys.add(letter);
}
acceptedKeys.add('Enter');
acceptedKeys.add('Backspace');
acceptedKeys.add('.');
acceptedKeys.add(':');
acceptedKeys.add('-');
acceptedKeys.add(' ');
acceptedKeys.add(`'`);
acceptedKeys.add(`"`);

addCardListeners();
addButtonListeners();
addDailyNumber();
addIntroModalListener();
addMainSuggestionListener();