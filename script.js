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

function formatGuesses(guesses) {
    return guesses.map((row) => `
        <div class="guessCard">
            <div class="cluster">${row[2]}</div>
            <div class="name">${row[0]}</div>
            <div class="score">${row[1]}</div>

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

    const scoreFloat = Number.parseFloat(dict.score).toFixed(2);
    const clusterFloat = Number.parseInt(dict.cluster);

    guesses.push([guessString, scoreFloat, clusterFloat]);

    const topGuesses = [...guesses];
    topGuesses.sort((a, b) => a[1] - b[1]);

    const formattedTop = formatGuesses(topGuesses);
    const formattedRecent = formatGuesses(guesses);

    updateContainer(formattedTop, topContainer);
    updateContainer(formattedRecent, recentContainer);

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

// const canvas = document.getElementById("canvas");
// const ctx = canvas.getContext("2d");
// const dpr = window.devicePixelRatio || 1;
// canvas.width = 200 * dpr;
// canvas.height = 200 * dpr;
// ctx.scale(dpr, dpr);
// ctx.beginPath();
// ctx.arc(100, 100, 5, 0, 2 * Math.PI);
// ctx.fillStyle = "red";
// ctx.fill();
// console.log(ctx);