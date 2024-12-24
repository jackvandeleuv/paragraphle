function wrapResult(text) {
    return `<div id="result">${text}</div>`
}

function updateResults(results, element) {
    const array = [];
    for (const r of results) {
        array.push(wrapResult(r));
    }
    const updatedResults = array.join('\n');
    element.innerHTML = updatedResults;
}

async function getSuggestions(input) {
    if (input === '') {
        return
    }
    const url = `http://127.0.0.1:5000/suggestion/${input}/limit/5`;
    const result = await fetch(url);
    const text = await result.json();
    const strings = text.map((x) => x[1]);
    const resultsDiv = document.getElementById('resultContainer');
    if (strings.length > 0) {
        updateResults(strings, resultsDiv);
        topSuggestion = [text[0][0], text[0][1]];
    } else {
        updateResults([''], resultsDiv)
    }
}

async function guess(guessId, guessString) {
    if (guessId === '') {
        return
    }
    const guessDiv = document.getElementById('guessContainer');
    const url = `http://127.0.0.1:5000/guess/${guessId}`;
    const result = await fetch(url);
    const score = await result.text();
    console.log(`score: ${score}`)
    const scoreFloat = Number.parseFloat(score);
    guesses.push([guessString, scoreFloat]);
    guesses.sort((a, b) => a[1] - b[1]);
    if (guesses.length > 15) {
        guesses = guesses.slice(end=15);
    }
    const formatted = guesses.map((row) => `<div>${row[0]}: ${row[1]}</div>`);
    updateResults(formatted, guessDiv);
}

let topSuggestion = [-1, ''];

const guesses = [];

const main = document.getElementById("main");

const formHTML = `
    <form id="form">
        <input id="form-input" name="form-input" type="text">
    </form>
`;
main.insertAdjacentHTML("afterend", formHTML);

const resultContainer = `<div id="resultContainer"></div><br>`;
main.insertAdjacentHTML("afterend", resultContainer);

const guessContainer = `<div id="guessContainer"></div><br>`;
main.insertAdjacentHTML("afterend", guessContainer);

const form = document.getElementById("form");
form.addEventListener("input", async (event) => {
    event.preventDefault();
    const input = event.target.value;
    await getSuggestions(input);
})

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    // const input = document.getElementById('form-input').value
    console.log(`submitting topSuggestion: ${topSuggestion}`);
    await guess(topSuggestion[0], topSuggestion[1]);
    document.getElementById('form-input').value = '';
})
