function updateContainer(items, container) {
    const updatedItems = items.join('\n');
    container.innerHTML = updatedItems;
}

async function getSuggestion(input) {
    topSuggestion = [-1, ''];

    if (input === '') {
        return
    }

    const suggestionContainer = document.getElementById('suggestionContainer');

    const url = `http://127.0.0.1:5000/suggestion/${input}/limit/5`;
    const result = await fetch(url)
    
    if (!result.ok) {
        updateContainer([], suggestionContainer);
        return
    }

    const text = await result.json();

    const emptyCard = `<div class="suggestionCard"></div>`;

    const items = text.map((x) =>
        `<div class="suggestionCard">${x[3]}</div>`
    );

    while (items.length < 5) {
        items.push(emptyCard)
    }

    updateContainer(items, suggestionContainer);
    topSuggestion = [text[0][0], text[0][3]];
}

function formatGuesses(guesses) {
    return guesses.map((row) => `
        <div class="guessCard">
            <div class="cluster" style="background-color: ${angleToColor(clusterToAngle(row[2]))};">${row[2]}</div>
            <div class="name">${row[0]}</div>
            <div class="distance">${row[1]}</div>
        </div>
    `)
}

async function postGuess(guessId, guessString) {
    if (guessId === -1) {
        return
    }
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

    guesses.push([guessString, distanceString, clusterInt]);
    renderCanvas(guesses);

    const uniqueTop = [];
    const seen = new Set();
    for (let guess of guesses) {
        if (seen.has(guess[0])) {
            continue
        }
        seen.add(guess[0]);
        uniqueTop.push([...guess]);
    }

    uniqueTop.sort((a, b) => a[1] - b[1]);

    const recentGuesses = [...guesses];
    recentGuesses.reverse();

    const formattedTop = formatGuesses(uniqueTop);
    const formattedRecent = formatGuesses(recentGuesses);

    updateContainer(formattedTop, topContainer);
    updateContainer(formattedRecent, recentContainer);
}

function renderCanvas(guesses) {
    const closest = [...guesses];
    closest.sort((a, b) => a[1] - b[1]);
    const seen = new Set();
    points = [];
    for (let guess of closest) {
        if (seen.has(guess[2])) {
            const noTitle = [...guess];
            noTitle[0] = '';
            points.push(noTitle);
            continue
        }
        seen.add(guess[2]);
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
    for (let x of points) {
        renderGuess(
            x[0], 
            x[2], 
            Number.parseFloat(x[1])
        )
    }
}

function writeLabel(label, x, y) {
    const LABEL_SIZE = 6;
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

    const xOffset = canvas.offsetWidth / 2;
    const yOffset = canvas.offsetHeight / 2;
    const scaledDistance = Math.pow(distance + 1, 7);

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
        await postGuess(topSuggestion[0], topSuggestion[1]);
        document.getElementById('form-input').value = '';
    })
}

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

function drawDot(color, x=null, y=null) {
    const DOT_RADIUS = 2;

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
let topSuggestion = [-1, ''];
let guesses = [];

document.addEventListener("DOMContentLoaded", () => {
    fetch(`http://127.0.0.1:5000/ping/${window.screen.width}/${window.screen.height}/${window.innerWidth}/${window.innerHeight}/${window.devicePixelRatio}`);
    add_form_listeners();
    drawConicGradient();
    drawDot('white');
    scaleCanvas();
});
