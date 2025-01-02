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

    const distanceFloat = Number.parseFloat(dict.distance).toFixed(2);
    const clusterFloat = Number.parseInt(dict.cluster);

    guesses.push([guessString, distanceFloat, clusterFloat]);

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

let topSuggestion = [-1, ''];

let guesses = [];

fetch(`http://127.0.0.1:5000/ping/${window.screen.width}/${window.screen.height}/${window.innerWidth}/${window.innerHeight}/${window.devicePixelRatio}`);

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