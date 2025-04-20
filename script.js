class Suggestion {
    constructor (article_id = -1, text = '') {
        this.article_id = article_id;
        this.text = text;
    }

    getHTML() {
        return `<div class="suggestionCard">${this.text.toUpperCase()}</div>`
    }
}

class TopSuggestion {
    constructor (article_id = -1, text = '') {
        this.article_id = article_id;
        this.text = text;
    }

    getHTML() {
        return `<div id="topSuggestionCard" class="topSuggestionCard">${this.text.toUpperCase()}</div>`
    }
}


class TopGuessesBox {
    constructor (
        chunk = "", 
        distance = -1, 
        article_id = -1,
        title = "",
        chunk_id = -1
    ) {
        this.chunk = chunk;
        this.distance = Math.round(distance * 100) / 100;
        this.article_id = article_id;
        this.title = title;
        this.chunk_id = chunk_id;
    }

    getHTML() { 
        const color = calculateDistanceColor(this.distance);
        return `
            <div title="${this.title.toUpperCase()}" class="topGuessesBox">
                <div class="topGuessesTitle">
                    <h4 style="background-color: ${color}; opacity">
                        Distance: ${this.distance}
                    </h4>
                </div>
                <p>${this.chunk}</p>
            </div>
        `
    }
}

class GuessFeatureBox {
    constructor (
        chunk = "", 
        distance = -1, 
        article_id = -1, 
        rank = -1,
        chunk_id = -1
    ) {
        this.chunk = chunk;
        this.distance = Math.round(distance * 100) / 100;
        this.article_id = article_id;
        this.rank = rank;
        this.chunk_id = chunk_id;
    }

    getHTML() {
        const color = calculateDistanceColor(this.distance);
        return `
            <div class="guessFeatureBox">
                <div class="guessFeatureTitle">
                    <h3>(${this.rank})</h3>
                    <div class="distanceBox" style="background-color: ${color};">
                        <h3>Distance ${this.distance}</h3>
                    </div>
                </div>
                <p>${this.chunk}</p>
            </div>
        `
    }
}

function calculateDistanceColor(distance) {
    if (distance > .7) {
        return "var(--cold)"
    } else if (distance > .5) {
        return "var(--warm)"
    } else if (distance > .3) {
        return "var(--hot)"
    } else {
        return "var(--blazing)"
    }
}

function updateContainer(items, container) {
    container.innerHTML = items
        .map((item) => item.getHTML())
        .join('\n');
    add_enter_listener();
}

async function getSuggestion(input) {
    if (input === '') return;

    const suggestionsContainer = document.getElementById('suggestionContainer');
    const topSuggestionBox = document.getElementById('topSuggestionBox');

    const url = `http://127.0.0.1:5000/suggestion/${input}/limit/5`;
    const result = await fetch(url);
    
    if (!result.ok) {
        updateContainer(
            [
                new Suggestion(), 
                new Suggestion(), 
                new Suggestion(), 
                new Suggestion(), 
                new Suggestion()
            ], 
            suggestionsContainer
        );
        return
    }

    const text = await result.json();

    const suggestions = text.map((x) => new Suggestion(x[0], x[1]));

    while (suggestions.length < 5) {
        suggestions.push(new Suggestion())
    }

    updateContainer(suggestions, suggestionsContainer);
    topSuggestion = new TopSuggestion(text[0][0], text[0][1]);
    updateContainer([topSuggestion], topSuggestionBox);
}

function add_form_listeners() {
    const form = document.getElementById("form");

    form.addEventListener("input", async (event) => {
        event.preventDefault();
        const input = event.target.value;
        await getSuggestion(input);
    })
    
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (topSuggestion.article_id === -1) return;

        const formInput = document.getElementById("form-input");
        formInput.disabled = true;
        formInput.value = '';

        await guess_article(topSuggestion.article_id, topSuggestion.text);
        topSuggestion = new TopSuggestion();

        formInput.disabled = false;
        formInput.focus();
    })
}

function add_enter_listener() {
    const form = document.getElementById('form-input');
    const topSuggestionCard = document.getElementById('topSuggestionCard');

    form.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter') return;
        topSuggestionCard.style.backgroundColor = 'var(--dark-mid)';
        topSuggestionCard.style.color = 'var(--light-full)';

    });

    form.addEventListener('keyup', function(event) {
        if (event.key !== 'Enter') return;
        topSuggestionCard.style.backgroundColor = 'var(--light-mid)';
        topSuggestionCard.style.color = 'var(--dark-full)';
    });
}

async function guess_article(article_id, title) {
    const url = `http://127.0.0.1:5000/guess_article/${article_id}`;
    const guessFeatureBoxContainer = document.getElementById('guessFeatureBoxContainer');
    const topGuessesContainer = document.getElementById('topGuessesContainer');
    const topFeatureArticleTitle = document.getElementById('guessFeatureArticleTitle');

    guessFeatureBoxContainer.innerHTML = "<progress></progress";
    topFeatureArticleTitle.innerHTML = `<h2>${title.toUpperCase()}</h2>`

    const chunks = await fetch(url).then(async (response) => await response.json());
    
    const guessFeatureBoxes = chunks.map(
        (chunk, i) => new GuessFeatureBox(chunk[1], chunk[2], article_id, i + 1, chunk[0])
    )
    updateContainer(guessFeatureBoxes, guessFeatureBoxContainer);

    const topGuessesBox = chunks.map(
        (chunk) => new TopGuessesBox(chunk[1], chunk[2], article_id, title, chunk[0])
    )

    // Dedup top guesses.
    for (const box of topGuessesBox) {
        if (topGuessesIds.has(box.chunk_id)) continue;
        topGuessesIds.add(box.chunk_id);
        topGuesses.push(box);
    }

    topGuesses.sort((a, b) => a.distance - b.distance);
    updateContainer(topGuesses, topGuessesContainer);

    const topSuggestionCard = document.getElementById('topSuggestionCard');
    topSuggestionCard.style.backgroundColor = 'var(--light-mid)';
    topSuggestionCard.style.color = 'var(--dark-full)';
}

const topGuesses = [];
const topGuessesIds = new Set();
let topSuggestion = new TopSuggestion();
add_enter_listener();
add_form_listeners();
