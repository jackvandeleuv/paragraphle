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
        `<li>${x[1]}></li>`
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
    const formatted = guesses.map((row) => `<div>${row[0]}: ${row[1]}</div>`);
    updateContainer(formatted, guessDiv);
}

let topSuggestion = [-1, ''];

let guesses = [];

const main = document.getElementById("main");

const formHTML = `
    <form id="form" autocomplete="off">
        <input id="form-input" name="form-input" type="text">
    </form>
`;
main.insertAdjacentHTML("afterend", formHTML);

const suggestionContainer = `<ol id="suggestionContainer" class="suggestionContainer></ol>`;
main.insertAdjacentHTML("afterend", suggestionContainer);

const guessContainer = `<div id="guessContainer" class="guessContainer"></div><br>`;
main.insertAdjacentHTML("afterend", guessContainer);

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
    document.getElementById('form').value = '';
})
