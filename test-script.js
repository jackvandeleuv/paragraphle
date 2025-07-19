function temperatureToColor(value) {
  console.log(value)
  const clamped = Math.max(0, Math.min(2, value));

  const palette = [
    'red-700',   // 0.000
    'red-600',   // 0.125
    'orange-600',// 0.250
    'orange-500',// 0.375
    'amber-500', // 0.500
    'amber-400', // 0.625
    'yellow-400',// 0.750
    'lime-400',  // 0.875
    'lime-300',  // 1.000
    'green-300', // 1.125
    'emerald-300',//1.250
    'teal-300',  // 1.375
    'cyan-300',  // 1.500
    'sky-400',   // 1.625
    'blue-400',  // 1.750
    'blue-500',  // 1.875
    'blue-600'   // 2.000
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
        const originalScore = scoreEl.textContent.trim();

        card.addEventListener('click', () => {
            const expanded = card.classList.toggle('expanded');

            shortEl.classList.toggle('hidden');
            fullEl.classList.toggle('hidden');

            title.classList.toggle('text-lg', expanded);
            title.classList.toggle('font-bold', expanded);

            scoreEl.classList.toggle('text-lg', expanded);
            scoreEl.classList.toggle('font-semibold', expanded);
            scoreEl.textContent = expanded ? `Score: ${originalScore}` : originalScore;

            wikiBtn.classList.toggle('hidden', !expanded);
        });
    });
}

async function loadSuggestions() {
    const input = document.getElementById('mainSuggestionText').innerHTML.toUpperCase();
    if (input === '') return;
    const suggestionsResponse = await fetch(`https://api.wiki-guess.com/suggestion/${input}/limit/4`);
    const suggestions = await suggestionsResponse.json();
    console.log(suggestions)
    const buttons = suggestions
        .data
        .slice(1, 4)
        .map((row) => `<button class="chip">${row.title.slice(0, 15)}</button>`)
        .join('');
    document.getElementById('suggestionBox').innerHTML = buttons;
}

async function loadEmptySuggestions() {
    document.getElementById('suggestionBox').innerHTML = `
        <button class="chip" style="border: 1px solid #ffa2a2; color: #ffa2a2;">-</button>
        <button class="chip" style="border: 1px solid #ffa2a2; color: #ffa2a2;">-</button>
        <button class="chip" style="border: 1px solid #ffa2a2; color: #ffa2a2;">-</button>
    `;
}

async function loadGuess(guessArticleId=1000) {
    document.getElementById('lastGuessText').innerHTML = '...';
    document.getElementById('lastGuessDistance').innerHTML = '...';
    document.getElementById('guessCount').innerHTML = ++guessCount;

    const guessResponse = await fetch(`https://api.wiki-guess.com/guess_article/${guessArticleId}/limit/10`);
    const guessData = await guessResponse.json();
    guessData.sort((a, b) => a.distance - b.distance);
    const guesses = guessData
        .map((row) => `
            <article data-card
                class="relative bg-slate-700/30 border border-slate-600 rounded p-4 pt-5 text-sm leading-snug">
                <span class="card-title absolute -top-2 left-2 bg-slate-900 px-1 text-xs font-bold uppercase">
                ${row.title}
                </span>
                <span class="card-score absolute -top-2 right-2 bg-slate-900 px-1 text-xs font-bold">
                ${row.distance.toFixed(2)}
                </span>

                <p>
                <span class="short">
                    ${row.chunk.slice(0, 100)}...
                </span>

                <span class="full hidden">
                    ${row.chunk}
                </span>
                </p>

                <a href="${row.url}">
                    <button
                        class="wiki-btn hidden mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1 rounded">
                        See on Wikipedia
                    </button>
                </a>
            </article>
        `).join('');
    document.getElementById('article-list').innerHTML = guesses;
    document.getElementById('lastGuessText').innerHTML = guessData[0].title;

    // const displayDistance = Math.round((Math.pow(guessData[0].distance + 1, 1.5) * 500) - 500);
    const displayDistance = guessData[0].distance.toFixed(2);

    document.getElementById('lastGuessDistance').innerHTML = `Distance: ${displayDistance}`;

    const guessDataTop = guessData[0].distance;
    const color = temperatureToColor(guessDataTop);
    console.log(color);
    document.getElementById('lastGuessBox').classList.add(`border-${color}`);
    document.getElementById('lastGuessBox').classList.add(`text-${color}`);

    addCardListeners();

    bestScore = Math.min(bestScore, guessDataTop)
    const progress = Math.round(((1 - Math.min(bestScore, 1)) / 1) * 100);
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressBar').classList.add(`bg-${temperatureToColor(bestScore)}`);
}

function flagNoSuggestion() {
    document.getElementById('mainSuggestion').style.border = '1px solid #ffa2a2';
    document.getElementById('mainSuggestion').style.color = '#ffa2a2';
    document.getElementById('mainSuggestionPrompt').innerHTML = '';
    loadEmptySuggestions();
}

async function updateMainSuggestion() {
    document.getElementById('mainSuggestionPrompt').innerHTML = '...';
    const input = document.getElementById('mainSuggestionText').innerHTML.toUpperCase();
    if (input === '') {
        return flagNoSuggestion();
    }


    const suggestionsResponse = await fetch(encodeURI(`https://api.wiki-guess.com/suggestion/${input}/limit/1`));
    const suggestions = await suggestionsResponse.json();

    if (suggestions.data.length === 0) {
        return flagNoSuggestion();
    }

    document.getElementById('mainSuggestion').style.color = '#fff';
    document.getElementById('mainSuggestion').style.border = `1px solid #475569`;
    
    mainSuggestion = suggestions.data[0];
    const topSuggestion = mainSuggestion.title.toUpperCase().trim();
    const topSuggestionPostfix = topSuggestion.replace(input, '');
    document.getElementById('mainSuggestionPrompt').innerHTML = topSuggestionPostfix;
    loadSuggestions();
}

function addButtonListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            return;
        } else if (e.key === 'Backspace') {
            const current = document.getElementById('mainSuggestionText').innerText;
            document.getElementById('mainSuggestionText').innerHTML = current.slice(0, current.length - 1);
            updateMainSuggestion();
        } else if (e.key === 'Enter') {
            loadGuess(mainSuggestion.article_id);
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
            if (value === '←') {
                const current = document.getElementById('mainSuggestionText').innerText;
                document.getElementById('mainSuggestionText').innerHTML = current.slice(0, current.length - 1);
                updateMainSuggestion();
            }
            else if (value === 'Enter') {
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

let guessCount = 0;
let text = 'INTERNET ARCH';
let mainSuggestion;
let bestScore = 2;

addCardListeners();
loadSuggestions();
addButtonListeners();
updateMainSuggestion();