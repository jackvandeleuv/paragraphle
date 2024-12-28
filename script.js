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
        `<div class="suggestionCard">${x[1]}</div>`
    );

    const suggestionContainer = document.getElementById('suggestionContainer');

    if (items.length > 0) {
        updateContainer(items, suggestionContainer);
        topSuggestion = [text[0][0], text[0][1]];
    } else {
        updateContainer([''], suggestionContainer)
    }
}

async function postGuess(guessId, guessString) {
    if (guessId === '') {
        return
    }
    const guessDiv = document.getElementById('guessContainer');
    const url = `http://127.0.0.1:5000/guess_id/${guessId}`;
    const result = await fetch(url);
    const score = await result.text();
    console.log(`score: ${score}`)
    const scoreFloat = Number.parseFloat(score);
    guesses.push([guessString, scoreFloat]);
    guesses.sort((a, b) => a[1] - b[1]);
    if (guesses.length > 15) {
        guesses = guesses.slice(0, 15);
    }
    const formatted = guesses.map((row) => `<div class="guessCard">${row[0]}: ${row[1]}</div>`);
    updateContainer(formatted, guessDiv);
}

let topSuggestion = [-1, ''];

let guesses = [];

const main = document.getElementById("main");

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

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");


const dpr = window.devicePixelRatio || 1;

// Set the canvas width/height *in pixels* to account for the dpr
// We still want it to *appear* as 200x200 in CSS
canvas.width = 200 * dpr;
canvas.height = 200 * dpr;

// Scale the context to match
ctx.scale(dpr, dpr);

// Now, drawing a circle of radius 5 at (100, 100)
ctx.beginPath();
ctx.arc(100, 100, 5, 0, 2 * Math.PI);
ctx.fillStyle = "red";
ctx.fill();

console.log(ctx);