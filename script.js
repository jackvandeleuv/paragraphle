class Suggestion {
    constructor (article_id = -1, text = '') {
        const cleanText = text.toUpperCase();
        this.article_id = article_id;
        this.text = cleanText;
        this.clippedText = clipText(cleanText);
        this.elem = this.makeElem();
        addSuggestionListener(this.elem);
    }

    makeElem() {
        const topSuggestionCard = document.createElement('button');
        topSuggestionCard.classList.add('suggestionCard');
        topSuggestionCard.classList.add('noSelect')
        topSuggestionCard.title = this.text;
        topSuggestionCard.innerText = this.clippedText;
        topSuggestionCard.id = `suggestion-${this.article_id}`;
        return topSuggestionCard;
    }
}

class TopSuggestion {
    constructor (article_id = -1, text = '') {
        const cleanText = text.toUpperCase();
        this.article_id = article_id;
        this.text = cleanText;
        this.clippedText = clipText(cleanText);
        this.elem = this.makeElem();
        addSuggestionListener(this.elem);
        this.addTopSuggestionListener();
    }

    addTopSuggestionListener() {
        const form = document.getElementById('form-input');

        form.addEventListener('keydown', function(event) {
            // const topSuggestionCard = document.getElementById('topSuggestionCard');
            if (event.key !== 'Enter') return;
            // topSuggestionCard.style.backgroundColor = 'var(--dark-mid)';
            // topSuggestionCard.style.color = 'var(--light-full)';

        });

        form.addEventListener('keyup', function(event) {
            // const topSuggestionCard = document.getElementById('topSuggestionCard');
            if (event.key !== 'Enter') return;
            // topSuggestionCard.style.backgroundColor = 'var(--light-mid)';
            // topSuggestionCard.style.color = 'var(--dark-full)';
        });
    }

    makeElem() {
        const topSuggestionCard = document.createElement('button');
        topSuggestionCard.classList.add('topSuggestionCard');
        topSuggestionCard.classList.add('noSelect')
        topSuggestionCard.id = `suggestion-${this.article_id}`;
        topSuggestionCard.title = this.text;
        topSuggestionCard.innerText = this.clippedText;
        return topSuggestionCard;
    }
}

function addSuggestionListener(element) {
    element.addEventListener('click', async function(event) {
        if (guessingArticle) return;

        event.target.classList.add('suggestionHighlighted');

        const article_id = event.target.id.split('-')[1];
        await guessArticle(article_id, event.target.title);
        event.target.classList.remove('suggestionHighlighted');
    })
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
        this.elem = this.getElem();
    }

    getElem() { 
        const color = calculateDistanceColor(this.distance);
        const topGuessesBox = document.createElement('div');
        topGuessesBox.classList.add('topGuessesBox');
        topGuessesBox.title = this.title.toUpperCase();

        const innerHTML = `
            <div class="topGuessesTitle" style="background-color: ${color};">
                <h4>
                    ${this.title}
                </h4>
                <h4>
                    Distance: ${this.distance}
                </h4>
            </div>
        `;

        topGuessesBox.innerHTML = innerHTML;
        return topGuessesBox;
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
        this.elem = this.makeElem();
    }

    makeElem() {
        const color = calculateDistanceColor(this.distance);

        const guessFeatureBox = document.createElement('div');
        guessFeatureBox.classList.add('guessFeatureBox');

        const innerHTML = `
            <div class="guessFeatureTitle">
                <h3>(${this.rank})</h3>
                <div class="distanceBox" style="background-color: ${color};">
                    <h3>Distance ${this.distance}</h3>
                </div>
            </div>
            <p>${this.chunk}</p>
        `;

        guessFeatureBox.innerHTML = innerHTML;

        return guessFeatureBox;
    }
}

function clipText(text) {
    const MAX_LEN = 30;
    const diff = text.length - MAX_LEN;
    if (diff > 0) {
        return text.slice(0, MAX_LEN) + '...';
    }
    return text;
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
    container.innerHTML = '';
    for (const item of items) {
        container.appendChild(item.elem)
    }
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
        if (guessingArticle) return;

        const formInput = document.getElementById("form-input");
        formInput.disabled = true;
        formInput.value = '';

        await guessArticle(topSuggestion.article_id, topSuggestion.text);
        topSuggestion = new TopSuggestion();

        formInput.disabled = false;
        formInput.focus();
    })
}

async function getTargetTokens() {
    const response = await fetch('http://127.0.0.1:5000/keywords');
    const tokens = new Map(Object.entries(await response.json()));
    const total = tokens.values().reduce((a, b) => a + b);
    const normalizedTokens = new Map();
    for (const token of tokens.keys()) {
        const rawCount = tokens.get(token);
        normalizedTokens.set(token, rawCount / total);
    }
    return tokens;
}

async function getTopTokens() {
    await targetTokens;
    const topTokens = new Map();
    for (const token of guessTokens.keys()) {
        if (!targetTokens.get(token)) continue;
        const guessCount = guessTokens.get(token) / totalGuessTokens;
        const targetCount = targetTokens.get(token);
        topTokens.set(token, guessCount * targetCount);
    }
}

function urlToName(title) {
    const titleSplit = title.split('/wiki/');
    return titleSplit[titleSplit.length - 1];
}

async function getWikiImage(url) {
    const name = urlToName(url);
    const imageURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${name}`;
    console.log(imageURL)
    const res = await fetch(imageURL, {headers:{'Accept': 'application/json'}});
    if (!res.ok) return 'https://upload.wikimedia.org/wikipedia/commons/7/78/Claude_Monet_-_The_Magpie_-_Google_Art_Project.jpg';
    const data = await res.json();
    return data.originalimage?.source || data.thumbnail?.source || null;
}

function updateScoreBar() {
    /**
    *   bestScore is 2 (furthest) to 0 (closest).
    *   2 - bestScore inverts the range.
    *   Then we clip the score to go from 1 to 2.
    */
    const scoreBar = document.getElementById('scoreBar');
    scoreBar.value = Math.max(2 - bestScore, 1) - 1;
}

async function guessArticle(article_id, title, limit=3) {
    console.log(article_id)
    guessingArticle = true;

    const url = `http://127.0.0.1:5000/guess_article/${article_id}/limit/${limit}`;
    const guessFeatureBoxContainer = document.getElementById('guessFeatureBoxContainer');
    const topGuessesContainer = document.getElementById('topGuessesContainer');
    const topFeatureArticleTitle = document.getElementById('guessFeatureArticleTitle');

    guessFeatureBoxContainer.innerHTML = "<progress></progress";
    topFeatureArticleTitle.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; width: 100%; padding: 10px;">
            <img id="guessImage" class="guessImage" style="height: 200px;" src=""></img>
            <h2>${title.toUpperCase()}</h2>
        </div>
    `;

    const chunks = await fetch(url).then(async (response) => await response.json());

    const guessImage = document.getElementById('guessImage');
    guessImage.src = await getWikiImage(chunks[0][3]);

    const cleanChunks = chunks.map((chunk) => chunk[1].toLowerCase().trim());
    for (const chunk of cleanChunks) {
        if (!guessTokens.has(chunk)) continue;
        const count = guessTokens.get(chunk);
        guessTokens.set(chunk, count + 1);
        totalGuessTokens += 1;
    }
    
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

    if (topGuesses) {
        bestScore = Math.min(topGuesses[0].distance, bestScore);
        updateScoreBar();
    }

    updateContainer(topGuesses, topGuessesContainer);

    const topSuggestionCard = document.getElementsByClassName('topSuggestionCard');
    topSuggestionCard.backgroundColor = 'var(--light-mid)';
    topSuggestionCard.color = 'var(--dark-full)';

    console.log(`top tokens: ${await getTopTokens()}`);

    guessingArticle = false;
}

// Globals.
const topGuesses = [];
const topGuessesIds = new Set();
let topSuggestion = new TopSuggestion();

add_form_listeners();

const targetTokens = getTargetTokens();  // Normalized.
const guessTokens = new Map();
let totalGuessTokens = 0;

let bestScore = 2;  // Range from 2 to 0.

let guessingArticle = false;
