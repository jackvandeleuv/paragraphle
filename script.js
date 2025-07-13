class Suggestion {
    constructor (
        article_id = -1, clean_title = '', count = -1, 
        title = '', url = '', id = -1, suggestionType = 'suggestionCard'
    ) {
        const cleanText = clean_title.toUpperCase();
        this.article_id = article_id;
        this.text = cleanText;
        this.clippedText = this.clipText(cleanText);
        this.url = url;
        this.id = id;
        this.title = title;
        this.suggestionType = suggestionType;
    }

    clipText(text) {
        if (text === '') return '';
        const MAX_LEN = 30;
        const diff = text.length - MAX_LEN;
        if (diff > 0) {
            return text.slice(0, MAX_LEN) + '...';
        }
        return text;
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
        if (this.id === -1) return;

        event.target.classList.add('boxHighlighted');

        if (event.target.classList.contains('topSuggestionCard')) {
            await guessArticle(topSuggestion.article_id, topSuggestion.title, topSuggestion.url);
        } else {
            const suggestion = suggestions[event.target.id];
            await guessArticle(suggestion.article_id, suggestion.title, suggestion.url);
        }
        event.target.classList.remove('boxHighlighted');
    }
}

class TopKeywordsBox {
    constructor (keyword = '', score = -1, idx = -1) {
        this.keyword = keyword;
        this.score = score;
        this.displayScore = score.toFixed(2);
        this.idx = idx;
    }

    makeElem() {
        const box = document.createElement('div');
        box.classList.add('topKeywordsBox');

        const boxText = document.createElement('p');
        boxText.innerText = `(${this.idx}) ${this.keyword}`;
        box.appendChild(boxText);

        const boxScore = document.createElement('p');
        boxScore.innerText = this.displayScore;
        box.appendChild(boxScore);  

        return box;
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
        this.isOpen = defaultBoxIsOpen;
        this.idx = idx;
    }

    getFullDisplayChunk(chunk) {
        return chunk.slice(0, 35) + '... <span>More</span>';
    }
    
    getDisplayChunk() {
        const chunkText = document.createElement('p');
        chunkText.innerText = this.isOpen ? this.chunk : this.chunk.slice(0, 100) + '...';
        return chunkText;
    }

    makeElem() { 
        const color = calculateDistanceBackgroundColor(this.distance);
        const topGuessesBox = document.createElement('div');
        topGuessesBox.classList.add('topGuessesBox');
        topGuessesBox.style.border = `3px solid ${color}`;

        const innerHTML = `
                <div class="topGuessesBoxHeader">
                    <h5>
                        ${this.title}
                    </h5>
                    <h5 style="background-color: ${color};">
                        ${this.distance}
                    </h5>
                </div>
        `;

        topGuessesBox.innerHTML = innerHTML;

        topGuessesBox.appendChild(this.getDisplayChunk());

        topGuessesBox.id = this.idx;
        topGuessesBox.addEventListener('click', (e) => {
            topGuessesRef[e.currentTarget.id].isOpen = !topGuessesRef[e.currentTarget.id].isOpen
            updateContainer(topGuessesSorted, 'topGuessesContainer');
        })

        return topGuessesBox;
    }
}

class SkeletonGuessFeatureBox {
    constructor() {}

    makeElem() {
        const skeleton = document.createElement('div');
        skeleton.classList.add('skeletonGuessFeatureBox');
        return skeleton;
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
        const color = calculateDistanceBackgroundColor(this.distance);

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
        guessFeatureBox.style.border = `3px solid ${color}`;

        return guessFeatureBox;
    }
}

function calculateDistanceBackgroundColor(distance) {
    if (distance > .65) {
        return "var(--one)"
    } else if (distance > .50) {
        return "var(--two)"
    } else if (distance > .35) {
        return "var(--three)"
    } else if (distance > .20) {
        return "var(--four)"
    } else {
        return "var(--five)"
    }
}

function calculateDistanceLabel(distance) {
    if (distance > .65) {
        return "Brr... you are DISTANT"
    } else if (distance > .50) {
        return "You're still approximately very far away"
    } else if (distance > .35) {
        return "Oh wait you're onto something..."
    } else if (distance > .20) {
        return "You are GETTING THERE"
    } else if (distance == 0) {
        return "You GOT IT"
    } else {
        return "Ow shit ow that's hot as fuck ow"
    }
}

function updateContainer(items, containerID) {
    const container = document.getElementById(containerID);
    container.innerHTML = '';
    for (const item of items) {
        container.appendChild(item.makeElem())
    }
}

async function getSuggestion(input, limit=6) {
    if (input === '') return;

    const url = `${API_URI}/suggestion/${input}/limit/${limit}`;
    const result = await fetch(url);
    const resultJSON = await result.json();
    const text = resultJSON.data;

    if (!result.ok || !resultJSON.has_match) {
        updateContainer(
            [
                new Suggestion(), 
                new Suggestion(), 
                new Suggestion(), 
                new Suggestion(), 
                new Suggestion()
            ], 
            'suggestionContainer'
        );
        return
    }

    if (text.length > 0) {
        const first_row = text.pop();
        topSuggestion = new Suggestion(
            first_row.article_id,
            first_row.clean_title,
            first_row.count, 
            first_row.title, 
            first_row.url, 
            -1, 
            'topSuggestionCard'
        );
        updateContainer([topSuggestion], 'topSuggestionBox');
    }

    let idx = 0;
    suggestions = [];
    while (text.length > 0) {
        const row = text.pop();
        suggestions.push(new Suggestion(
            row.article_id,
            row.clean_title,
            row.count, 
            row.title, 
            row.url, 
            idx++, 
            'suggestionCard'
        ));
    }

    while (suggestions.length < limit - 1) {
        const blankSuggestion = new Suggestion();
        blankSuggestion.id = idx++;
        suggestions.push(blankSuggestion);
    }

    updateContainer(suggestions, 'suggestionContainer');
}

function addSidepanelButtonListeners() {
    chunksButton = document.getElementById('chunksButton');
    chunksButton.addEventListener('click', ((e) => {
        pastGuessesChunkMode = true;
        e.currentTarget.classList.add('boxHighlighted');
        document.getElementById('keywordsButton').classList.remove('boxHighlighted');
        document.getElementById('topGuessesArticleTitle').innerText = "Top Chunks";
        updateTopGuessesContainer();
    }));

    keywordsButton = document.getElementById('keywordsButton');
    keywordsButton.addEventListener('click', ((e) => {
        pastGuessesChunkMode = false;
        e.currentTarget.classList.add('boxHighlighted');
        document.getElementById('chunksButton').classList.remove('boxHighlighted');
        document.getElementById('topGuessesArticleTitle').innerText = "Top Keywords";
        updateTopGuessesContainer();
    }));

    expandButton = document.getElementById('expandButton');
    expandButton.addEventListener('click', (_) => {
        for (const box of topGuessesSorted) box.isOpen = !box.isOpen;
        defaultBoxIsOpen = !defaultBoxIsOpen;
        updateTopGuessesContainer();
        document.getElementById('expandButtonMessage').innerHTML = defaultBoxIsOpen ? 'Collapse All' : 'Expand All';
    });
}

function addFormListeners() {
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

function addModalListeners() {
    document.getElementById('winModal').addEventListener("click", async (event) => {
        event.preventDefault();
        document.getElementById('winModal').hidden = true;
    })

    document.getElementById('introModal').addEventListener("click", async (event) => {
        event.preventDefault();
        document.getElementById('introModal').hidden = true;
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
}

function updateScoreBar() {
    const scoreBar = document.getElementById('scoreBar');
    scoreBar.value = Math.max(1 - (1.3 * bestScore), 0);
    scoreBar.style.accentColor = calculateDistanceBackgroundColor(bestScore);
 
    const scoreMessage = document.getElementById('scoreMessage');
    scoreMessage.innerText = calculateDistanceLabel(bestScore);
}

async function getTargetStats() {
    const response = await fetch(`${API_URI}/target_stats`);
    const responseJSON = await response.json();

    responseJSON.token_counts = new Map(Object.entries(responseJSON.token_counts));
    responseJSON.chunks_with_token = new Map(Object.entries(responseJSON.chunks_with_token));

    return responseJSON
}

async function getKeywordScores() {
    /* 
        Combine the raw counts from the target and each guess into a score-per-token.
    */
    const targetStats = await targetStatsPromise;

    const scores = [];

    for (const token of targetStats.token_counts.keys()) {
        if (!guessStats.token_counts.has(token)) continue;

        const termFrequency = (
            guessStats.token_counts.get(token) / guessStats.n_tokens
        );

        const inverseDocumentFrequency = Math.log(
            (targetStats.n_chunks + guessStats.n_chunks) /
            (1 + targetStats.chunks_with_token.get(token) + guessStats.chunks_with_token.get(token))
        );
        scores.push({'keyword': token, 'score': termFrequency * inverseDocumentFrequency});
    }

    scores.sort((a, b) => b.score - a.score);

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
    for (const rawToken of tokens) {
        // const token = rawToken.replace(/[^A-Za-z0-9]+/g, '');
        const token = rawToken;

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

async function updateTopGuessesContainer() {
    if (pastGuessesChunkMode) {
        updateContainer(topGuessesSorted, 'topGuessesContainer');
    } else {
        const keywordScores = await getKeywordScores();
        const topKeywords = keywordScores.slice(0, 10).map(
            (row, idx) => new TopKeywordsBox(row.keyword, row.score, idx + 1)
        )
        updateContainer(topKeywords, 'topGuessesContainer');
    }
}

async function loadGuessHeader(url, title) {
    const guessFeatureArticleTitle = document.getElementById('guessFeatureArticleTitle');
    guessFeatureArticleTitle.innerText = title;

    const guessImage = document.getElementById('guessImage');
    const imagePromise = getWikiImage(url);
    guessImage.src = await imagePromise;
    guessImage.classList.add('guessImageLoaded');  
}

function updateGuessCount() {
    guessCount += 1;
    const counter = document.getElementById('guessCountMessage');
    counter.innerText = guessCount;
}

function makeSkeletonGuessFeatureBoxes() {
    return [
        new SkeletonGuessFeatureBox(),
        new SkeletonGuessFeatureBox(),
        new SkeletonGuessFeatureBox(),
        new SkeletonGuessFeatureBox(),
        new SkeletonGuessFeatureBox()
    ]
}

function renderWin(title) {
    isWin = true;

    const form = document.getElementById('form-input')
    form.disabled = true;
    form.value = '';

    document.getElementById('scoreBar').value = 1;
    document.getElementById('scoreMessage').innerHTML = `That wasn't too hard, was it?`;

    document.getElementById('winModal').hidden = false;
    document.getElementById('winModalGuesses').innerHTML = guessCount;
    document.getElementById('winModalArticle').innerHTML = title;
}

async function guessArticle(article_id, title, articleURL, limit=5) {
    if (isWin) return;

    guessingArticle = true;

    const url = `${API_URI}/guess_article/${article_id}/limit/${limit}`;

    const chunksPromise = fetch(url);

    updateContainer(makeSkeletonGuessFeatureBoxes(), 'guessFeatureBoxContainer');
    document.getElementById("form").input = '';

    loadGuessHeader(articleURL, title);

    const chunksResponse = await chunksPromise;
    if (!chunksResponse.ok) {
        updateContainer([], 'guessFeatureBoxContainer');
        guessingArticle = false;
        return;
    }
    const chunks = await chunksResponse.json();

    const guessFeatureBoxes = chunks.map(
        (chunk, i) => new GuessFeatureBox(chunk.chunk, chunk.distance, article_id, i + 1, chunk[0])
    );
    updateContainer(guessFeatureBoxes, 'guessFeatureBoxContainer');

    for (const chunk of chunks) {
        const chunk_id = chunk.chunk_id;
        if (topGuessesChunkIds.has(chunk_id)) continue;

        updateBOWStats(chunk.chunk);

        const nextRefId = topGuessesRef.length || 0;
        const box = new TopGuessesBox(chunk.chunk, chunk.distance, article_id, title, chunk_id, nextRefId);

        topGuessesChunkIds.add(box.chunk_id);
        topGuessesSorted.push(box);
        topGuessesRef.push(box);
    }

    topGuessesSorted.sort((a, b) => a.distance - b.distance);
    if (topGuessesSorted) {
        bestScore = Math.min(topGuessesSorted[0].distance, bestScore);
        updateScoreBar();
    }

    updateTopGuessesContainer();

    const topSuggestionCard = document.getElementsByClassName('topSuggestionCard');
    topSuggestionCard.backgroundColor = 'var(--light-mid)';
    topSuggestionCard.color = 'var(--dark-full)';

    updateGuessCount();

    if (chunks.length > 0 && chunks[0].is_win === true) {
        renderWin(title);
    }

    guessingArticle = false;
}

// Globals.
const API_URI = 'http://api.hoiuyg324yjg4o26ku5h63.uk/'

const topGuessesSorted = [];
const topGuessesRef = [];
const topGuessesChunkIds = new Set();

const defaultImage = 'https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/263px-Wikipedia-logo-v2.svg.png';

let topSuggestion = new Suggestion();
let suggestions = [];

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

let pastGuessesChunkMode = true;  // Chunks or Keywords.

let defaultBoxIsOpen = false;

let isWin = false;

addFormListeners(); 
addSidepanelButtonListeners();
addModalListeners();

document.getElementById('dailyNumber').innerHTML = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) - 20280;