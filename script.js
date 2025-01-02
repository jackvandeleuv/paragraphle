function updateContainer(items, container) {
    const updatedItems = items.join('\n');
    container.innerHTML = updatedItems;
}

async function getSuggestion(input) {
    if (input === '') {
        return
    }

    const url = `http://127.0.0.1:5000/suggestion/${input}/limit/5`;
    const result = await fetch(url);
    const text = await result.json();

    const items = text.map((x) =>
        `<div class="suggestionCard">${x[3]}</div>`
    );

    const suggestionContainer = document.getElementById('suggestionContainer');

    if (items.length > 0) {
        updateContainer(items, suggestionContainer);
        topSuggestion = [text[0][0], text[0][3]];
    } else {
        updateContainer([''], suggestionContainer)
    }
}

function formatGuesses(guesses) {
    return guesses.map((row) => `
        <div class="guessCard">
            <div class="cluster">${row[2]}</div>
            <div class="name">${row[0]}</div>
            <div class="distance">${row[1]}</div>
        </div>
    `)
}

async function postGuess(guessId, guessString) {
    if (guessId === '') {
        return
    }
    const topContainer = document.getElementById('guessContainerTop');
    const recentContainer = document.getElementById('guessContainerRecent');

    const url = `http://127.0.0.1:5000/guess_id/${guessId}`;
    const result = await fetch(url);
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
        console.log(seen);
    }

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawDot(300 / 2, 400 / 2);
    for (let x of points) {
        renderGuess(
            x[0], 
            x[2], 
            Number.parseFloat(x[1])
        )
    }
}

function writeLabel(label, x, y) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    ctx.fillText(label, x - 10, y - 5);
}

function renderGuess(title, cluster, distance) {
    const xOffset = 300 / 2;
    const yOffset = 400 / 2;
    const scaledDistance = Math.pow(distance + 1, 7);

    const angle = cluster % (2 * Math.PI);
    const x = (scaledDistance * Math.cos(angle)) + xOffset;
    const y = (scaledDistance * Math.sin(angle)) + yOffset;

    console.log(x, y)

    drawDot(x, y);
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
        console.log(`submitting topSuggestion: ${topSuggestion}`);
        await postGuess(topSuggestion[0], topSuggestion[1]);
        document.getElementById('form-input').value = '';
    })
}

function scaleCanvas(x, y) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = x * dpr;
    canvas.height = y * dpr;
    ctx.scale(dpr, dpr);
}

function drawDot(x, y) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fillStyle = "black";
    ctx.fill();
}

// Initialize.
fetch(`http://127.0.0.1:5000/ping/${window.screen.width}/${window.screen.height}/${window.innerWidth}/${window.innerHeight}/${window.devicePixelRatio}`);
add_form_listeners();
let topSuggestion = [-1, ''];
let guesses = [];

scaleCanvas(300, 400);
drawDot(300 / 2, 400 / 2);