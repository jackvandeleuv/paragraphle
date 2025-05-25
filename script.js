class Suggestion {
    constructor (
        article_id = -1, clean_title = '', count = -1, 
        title = '', url = '', id = -1, suggestionType = 'suggestionCard'
    ) {
        const cleanText = clean_title.toUpperCase();
        this.article_id = article_id;
        this.text = cleanText;
        this.clippedText = clipText(cleanText);
        this.url = url;
        this.id = id;
        this.title = title;
        this.suggestionType = suggestionType;
    }

    makeElem() {
        const topSuggestionCard = document.createElement('button');
        topSuggestionCard.id = this.id;
        topSuggestionCard.classList.add(this.suggestionType);
        topSuggestionCard.classList.add('noSelect')
        topSuggestionCard.innerText = this.clippedText;
        topSuggestionCard.addEventListener('click', this.suggestionListener);
        return topSuggestionCard;
    }

    async suggestionListener(event) {
        if (guessingArticle) return;

        event.target.classList.add('suggestionHighlighted');

        if (event.target.classList.contains('topSuggestionCard')) {
            await guessArticle(topSuggestion.article_id, topSuggestion.title, topSuggestion.url);
        } else {
            const suggestion = suggestions[event.target.id];
            await guessArticle(suggestion.article_id, suggestion.title, suggestion.url);
        }
        event.target.classList.remove('suggestionHighlighted');
    }
}

class TopGuessesBox {
    constructor (
        chunk = "", 
        distance = -1, 
        article_id = -1,
        title = "",
        chunk_id = -1,
        idx = -1
    ) {
        this.chunk = chunk;
        this.distance = Math.round(distance * 100) / 100;
        this.article_id = article_id;
        this.title = title;
        this.chunk_id = chunk_id;
        this.isOpen = false;
        this.idx = idx;
    }

    getFullDisplayChunk(chunk) {
        return chunk.slice(0, 50) + '... <span>More</span>';
    }

    // getDisplayButton() {
    //     const button = document.createElement('span');
    //     button.id = this.idx;
    //     button.innerText = this.isOpen ? 'Less' : 'More';
    //     button.addEventListener('click', (e) => {
    //         topGuessesRef[e.target.id].isOpen = !topGuessesRef[e.target.id].isOpen
    //         const topGuessesContainer = document.getElementById('topGuessesContainer');
    //         updateContainer(topGuessesSorted, topGuessesContainer);
    //     })
    //     return button;
    // }

    getDisplayChunk() {
        const chunkText = document.createElement('p');
        chunkText.innerText = this.isOpen ? this.chunk : this.chunk.slice(0, 100) + '...';
        return chunkText;
    }

    makeElem() { 
        const color = calculateDistanceColor(this.distance);
        const topGuessesBox = document.createElement('div');
        topGuessesBox.classList.add('topGuessesBox');
        topGuessesBox.style.backgroundColor = color;

        const innerHTML = `
                <div class="topGuessesBoxHeader">
                    <h5>
                        ${this.title}
                    </h5>
                    <p>
                        ${this.distance}
                    </p>
                </div>
        `;

        topGuessesBox.innerHTML = innerHTML;

        topGuessesBox.appendChild(this.getDisplayChunk());

        topGuessesBox.id = this.idx;
        topGuessesBox.addEventListener('click', (e) => {
            console.log(e.currentTarget)
            topGuessesRef[e.currentTarget.id].isOpen = !topGuessesRef[e.currentTarget.id].isOpen
            const topGuessesContainer = document.getElementById('topGuessesContainer');
            updateContainer(topGuessesSorted, topGuessesContainer);
        })

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

function calculateDistanceLabel(distance) {
    if (distance > .7) {
        return "Ice cold..."
    } else if (distance > .5) {
        return "Getting somewhere..."
    } else if (distance > .3) {
        return "Wait! Unless..."
    } else {
        return "You're in the danger zone!"
    }
}


function updateContainer(items, container) {
    container.innerHTML = '';
    for (const item of items) {
        container.appendChild(item.makeElem())
    }
}

async function getSuggestion(input, limit=6) {
    if (input === '') return;

    const suggestionsContainer = document.getElementById('suggestionContainer');
    const topSuggestionBox = document.getElementById('topSuggestionBox');

    const url = `http://127.0.0.1:5000/suggestion/${input}/limit/${limit}`;
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


    if (text.length > 0) {
        topSuggestion = new Suggestion(...text.pop(), ...[-1, 'topSuggestionCard']);
        updateContainer([topSuggestion], topSuggestionBox);
    }

    let idx = 0;
    suggestions = [];
    for (const item of text) {
        suggestions.push(new Suggestion(...item, ...[idx++, 'suggestionCard']))
    }

    while (suggestions.length < limit - 1) {
        const blankSuggestion = new Suggestion();
        blankSuggestion.id = idx++;
        suggestions.push(blankSuggestion);
    }

    updateContainer(suggestions, suggestionsContainer);
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

        await guessArticle(topSuggestion.article_id, topSuggestion.text, topSuggestion.url);
        topSuggestion = new Suggestion();
        topSuggestion.suggestionType = 'topSuggestionCard';

        formInput.disabled = false;
        formInput.focus();
    })
}

function urlToName(title) {
    const titleSplit = title.split('/wiki/');
    return titleSplit[titleSplit.length - 1];
}

async function getWikiImage(url) {
    try {
        const name = urlToName(url);
        const imageURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${name}`;
        const res = await fetch(imageURL, {headers: {'Accept': 'application/json'}});
        if (!res.ok) return defaultImage;
        const data = await res.json();
        return data.thumbnail?.source || defaultImage;
    } catch (error) {
        console.error(error);
        return defaultImage;
    }
    // return data.originalimage?.source || data.thumbnail?.source || null;
}

function updateScoreBar() {
    /**
    *   bestScore is 2 (furthest) to 0 (closest).
    *   2 - bestScore inverts the range.
    *   Then we clip the score to go from 1 to 2.
    */
    const scoreBar = document.getElementById('scoreBar');
    scoreBar.value = Math.max(2 - bestScore, 1) - 1;
    scoreBar.style.accentColor = calculateDistanceColor(bestScore);
 
    const scoreMessage = document.getElementById('scoreMessage');
    scoreMessage.innerText = calculateDistanceLabel(bestScore);
}

async function getTargetStats() {
    const response = await fetch('http://127.0.0.1:5000/target_stats');
    const responseJSON = await response.json();

    responseJSON.token_counts = new Map(Object.entries(responseJSON.token_counts));
    responseJSON.chunks_with_token = new Map(Object.entries(responseJSON.chunks_with_token));

    return responseJSON
}

async function getTokenScores() {
    /* 
        Combine the raw counts from the target and each guess into a score-per-token.
    */
    const targetStats = await targetStatsPromise;

    const scores = [];

    for (const token of targetStats.token_counts.keys()) {
        if (!guessStats.token_counts.has(token)) continue;

        // console.log(`
        //     --${token}--

        //     target tokens: ${targetStats.n_tokens},
        //     guess tokens: ${guessStats.n_tokens},

        //     target chunks: ${targetStats.n_chunks},
        //     guess chunks: ${guessStats.n_chunks},

        //     target chunks with token: ${targetStats.chunks_with_token.get(token)},
        //     guess chunks with token: ${guessStats.chunks_with_token.get(token)}
        // `)

        // const termFrequency = (
        //     (targetStats.token_counts.get(token) + guessStats.token_counts.get(token)) / 
        //     (targetStats.n_tokens + guessStats.n_tokens)
        // );

        const termFrequency = (
            guessStats.token_counts.get(token) / guessStats.n_tokens
        );

        const inverseDocumentFrequency = Math.log(
            (targetStats.n_chunks + guessStats.n_chunks) /
            (1 + targetStats.chunks_with_token.get(token) + guessStats.chunks_with_token.get(token))
        );
        scores.push(
            {
                'token': token,
                'score': termFrequency * inverseDocumentFrequency,
                'termFrequency': termFrequency,
                'IDF': inverseDocumentFrequency
            }
        );
    }

    return scores
}

function updateBOWStats(chunkText) {
    //     'n_chunks': 0,
    //     'n_tokens': 0,
    //     'chunks_with_token': new Map(),  // (token, chunks_with_token)
    //     'token_counts': new Map()  // (token, token_counts)

    const chunk = chunkText.toLowerCase().trim();
    const tokens = chunk.split(' ');

    guessStats.n_chunks = guessStats.n_chunks + 1;
    guessStats.n_tokens = guessStats.n_tokens + tokens.length;

    const seenToken = new Set();
    for (const token of tokens) {
        if (guessStats.token_counts.has(token)) {
            guessStats.token_counts.set(token, guessStats.token_counts.get(token) + 1)
        } else {
            guessStats.token_counts.set(token, 1)
        }
        
        if (seenToken.has(token)) continue;
        if (guessStats.chunks_with_token.has(token)) {
            guessStats.chunks_with_token.set(token, guessStats.chunks_with_token.get(token) + 1)
        } else {
            guessStats.chunks_with_token.set(token, 1)
        }
        seenToken.add(token);
    }
}

async function guessArticle(article_id, title, articleURL, limit=5) {
    guessingArticle = true;

    const url = `http://127.0.0.1:5000/guess_article/${article_id}/limit/${limit}`;
    const guessFeatureBoxContainer = document.getElementById('guessFeatureBoxContainer');
    const topGuessesContainer = document.getElementById('topGuessesContainer');
    const topFeatureArticleTitle = document.getElementById('guessFeatureArticleTitle');

    guessFeatureBoxContainer.innerHTML = "<progress></progress";
    topFeatureArticleTitle.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; width: 100%; padding: 10px;">
            <img id="guessImage" class="guessImage" src=""></img>
            <h2>${title}</h2>
        </div>
    `;

    const guessImage = document.getElementById('guessImage');
    const imagePromise = getWikiImage(articleURL);

    const chunks = await fetch(url).then(async (response) => await response.json());

    guessImage.src = await imagePromise;
    guessImage.classList.add('guessImageLoaded');  
    
    const guessFeatureBoxes = chunks.map(
        (chunk, i) => new GuessFeatureBox(chunk[1], chunk[2], article_id, i + 1, chunk[0])
    );
    updateContainer(guessFeatureBoxes, guessFeatureBoxContainer);

    for (const chunk of chunks) {
        const chunk_id = chunk[0];
        if (topGuessesChunkIds.has(chunk_id)) continue;

        updateBOWStats(chunk[1]);

        const nextRefId = topGuessesRef.length || 0;
        console.log(nextRefId)
        const box = new TopGuessesBox(chunk[1], chunk[2], article_id, title, chunk_id, nextRefId);

        topGuessesChunkIds.add(box.chunk_id);
        topGuessesSorted.push(box);
        topGuessesRef.push(box);
    }

    topGuessesSorted.sort((a, b) => a.distance - b.distance);

    if (topGuessesSorted) {
        bestScore = Math.min(topGuessesSorted[0].distance, bestScore);
        updateScoreBar();
    }

    updateContainer(topGuessesSorted, topGuessesContainer);

    const topSuggestionCard = document.getElementsByClassName('topSuggestionCard');
    topSuggestionCard.backgroundColor = 'var(--light-mid)';
    topSuggestionCard.color = 'var(--dark-full)';

    const tokenScoreMap = await getTokenScores();
    const sortedTokenScores = tokenScoreMap.sort((a, b) => b.score - a.score);
    console.log('\ntop tokens:');
    for (const row of sortedTokenScores.slice(0, 10)) {
        console.log(`${row.token}: ${row.score}`)
    }

    guessCount += 1;
    const counter = document.getElementById('guessCountMessage');
    counter.innerText = guessCount;

    guessingArticle = false;
}

// Globals.
const topGuessesSorted = [];
const topGuessesRef = [];
const topGuessesChunkIds = new Set();

const defaultImage = 'https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/263px-Wikipedia-logo-v2.svg.png';

let topSuggestion = new Suggestion();
let suggestions = [];

add_form_listeners(); 

//  Bag of words stats. Shared between target article and guess articles.
const guessStats = {
    'n_chunks': 0,
    'n_tokens': 0,
    'chunks_with_token': new Map(),  // (token, chunks_with_token)
    'token_counts': new Map()  // (token, token_counts)
}
const targetStatsPromise = getTargetStats();  // Initial stats for the target article.

let bestScore = 2;  // Range from 2 to 0.

let guessingArticle = false;

let guessCount = 0;

let pastGuessesChunks = true;  // Chunks or Keywords.
