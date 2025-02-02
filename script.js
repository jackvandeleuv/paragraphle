function updateContainer(items, container) {
    const html = items.map((item) => item.getHTML());
    const updatedItems = html.join('\n');
    container.innerHTML = updatedItems;
}

async function getSuggestion(input) {
    topSuggestion = new Suggestion();

    if (input === '') {
        return
    }

    const suggestionContainer = document.getElementById('suggestionContainer');

    const url = `http://127.0.0.1:5000/suggestion/${input}/limit/10`;
    const result = await fetch(url)
    
    if (!result.ok) {
        updateContainer([], suggestionContainer);
        return
    }

    const text = await result.json();

    const suggestion = text.map((x) =>
        new Suggestion(x[0], x[3])
    );

    while (suggestion.length < 5) {
        suggestion.push(new Suggestion())
    }

    updateContainer(suggestion, suggestionContainer);
    topSuggestion = new Suggestion(text[0][0], text[0][3]);
}

function scoreBucket(score) {
    let bucket = score;
    if (bucket > .95) {
        bucket = .95
    }
    if (bucket < .65) {
        bucket = .65;
    }

    bucket = Math.round(((bucket - .65) / 3)) + 1;

    return `dist${bucket}`;
}

class Suggestion {
    constructor (id = -1, text = '') {
        this.id = id;
        this.text = text;
    }

    getHTML() {
        return `
            <div class="suggestionCard">
                ${this.text}
            </div>
        `
    }
}

class Guess {
    constructor(
        text,
        distance,
        cluster,
        title,
        imageUrl,
        html = '',
        bucket = -1,
        color = ''
    ) {
        this.text = text;
        this.distance = distance;
        this.cluster = cluster;
        this.title = title;
        this.imageUrl = imageUrl;
        this.html = html;
        this.bucket = bucket;
        this.color = color;
    }

    __format() {
        if (this.bucket === -1) {
            this.bucket = scoreBucket(this.distance);
        }

        if (this.color === '') {
            this.color = angleToColor(clusterToAngle(this.cluster));
        }
    }

    async makeHTML() {
        if (this.html !== '') {
            return
        }

        this.__format();

        this.html = `
            <div class="guessCard ${this.bucket}">
                <img class="thumbnail" src="${this.imageUrl}"></img>
                <div class="cluster" style="background-color: ${this.color};">${this.cluster}</div>
                <div class="name">${this.text}</div>
                <div class="distance">${this.distance}</div>
            </div>
        `;
    }

    getHTML() {
        return this.html;
    }

    copy() {
        return new Guess(
            this.text,
            this.distance,
            this.cluster,
            this.title,
            this.imageUrl,
            this.html,
            this.bucket,
            this.color
        )
    } 
}

async function postGuess(guessId, guessString) {
    const topContainer = document.getElementById('guessContainerTop');
    const recentContainer = document.getElementById('guessContainerRecent');

    const url = `http://127.0.0.1:5000/guess_id/${guessId}`;
    const result = await fetch(url);
    
    if (!result.ok) {
        return
    }

    const dict = await result.json();

    const distanceFloat = Number.parseFloat(dict.distance)
    const distanceString = distanceFloat.toFixed(2);
    const clusterInt = Number.parseInt(dict.cluster);
    const title = dict.title;
    const imageUrl = dict.image_url || '';

    console.log('URL:' + imageUrl)

    const guess = new Guess(guessString, distanceString, clusterInt, title, imageUrl);
    await guess.makeHTML();
    guesses.push(guess);

    renderCanvas();

    const uniqueTop = [];
    const seen = new Set();
    for (const guess of guesses) {
        if (seen.has(guess.text)) {
            continue
        }
        seen.add(guess.text);
        uniqueTop.push(guess.copy());
    }

    uniqueTop.sort((a, b) => a.distance - b.distance);

    const recentGuesses = [...guesses];
    recentGuesses.reverse();

    updateContainer(uniqueTop, topContainer);
    updateContainer(recentGuesses, recentContainer);
}

function renderCanvas() {
    scaleCanvas();

    const closest = [...guesses];
    closest.sort((a, b) => a.distance - b.distance);
    const seen = new Set();
    points = [];
    for (const guess of closest) {
        if (seen.has(guess.cluster)) {
            const noTitle = guess.copy();
            noTitle.text = '';
            points.push(noTitle);
            continue
        }
        seen.add(guess.cluster);
        points.push(guess);
    }

    // Reset canvas
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    drawConicGradient();

    // Center dot
    drawDot("white", canvas.offsetWidth / 2, canvas.offsetHeight / 2);

    // Other points
    for (const point of points) {
        renderGuess(
            point.title, 
            point.cluster, 
            Number.parseFloat(point.distance)
        )
    }
}

function writeLabel(label, x, y) {
    const LABEL_SIZE = 12;
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.font = `500 ${LABEL_SIZE}px Georgia`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - 7);
}

function angleToColor(angle) {
    const normalizedTheta = (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    const hue = (normalizedTheta / (2 * Math.PI)) * 360;

    const saturation = 100; 
    const lightness = 60; 
    const hslColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    return hslColor;
}

function clusterToAngle(cluster) {
    const N_CLUSTERS = 300;
    const scaleBy = 2 * Math.PI / N_CLUSTERS;
    return cluster * scaleBy;
}

function renderGuess(title, cluster, distance) {
    const canvas = document.getElementById("canvas");

    const canvasScale = canvas.offsetWidth / 300;

    const xOffset = canvas.offsetWidth / 2;
    const yOffset = canvas.offsetHeight / 2;
    const scaledDistance = Math.pow(distance + 1, 7) * canvasScale;

    const angle = clusterToAngle(cluster);

    const x = (scaledDistance * Math.cos(angle)) + xOffset;
    const y = (scaledDistance * Math.sin(angle)) + yOffset;

    const color = angleToColor(angle);

    drawDot(color, x, y);
    writeLabel(title, x, y);
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
        if (topSuggestion.id === -1) {
            return
        }
        await postGuess(topSuggestion.id, topSuggestion.text);
        document.getElementById('form-input').value = '';
        topSuggestion = new Suggestion();
    })
}

function drawDot(color, x=null, y=null) {
    const DOT_RADIUS = 3;

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    x = x || canvas.offsetWidth;
    y = y || canvas.offsetHeight;

    // Outline
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS * 1.05, 0, 2 * Math.PI);
    ctx.fillStyle = "black";
    ctx.fill();

    // Inner color
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawConicGradient() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createConicGradient(
        0, 
        canvas.offsetWidth / 2, 
        canvas.offsetHeight / 2
    );
  
    for (let hue = 0; hue < 360; hue++) {
        const t = hue / 360; 
        const color = `hsl(${hue}, 100%, 50%)`;
        gradient.addColorStop(t, color);
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
}

// Initialize.
let topSuggestion = new Suggestion();
const guesses = [];
// const imageUrlCache = new Map();

document.addEventListener("DOMContentLoaded", () => {
    fetch(`http://127.0.0.1:5000/ping/${window.screen.width}/${window.screen.height}/${window.innerWidth}/${window.innerHeight}/${window.devicePixelRatio}`);
    add_form_listeners();
    drawConicGradient();
    drawDot('white');
});

function scaleCanvas() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.setAttribute("width", width * dpr);
    canvas.setAttribute("height", height * dpr);
    ctx.scale(dpr, dpr);
}

window.addEventListener('resize', renderCanvas);

renderCanvas();