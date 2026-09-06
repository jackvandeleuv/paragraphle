import { getSessionID, getSuggestions, guessArticle } from "./fetchData.js";
import { Game } from "./game.js";
import { disabledScreen, emptySuggestionElem, gameMenu, mainSuggestionElem, noResultSuggestionElem, winScreen } from "./templates.js";

function renderSuggestions(suggestions) {
    const wrapper = document.getElementById('suggestionDiv');
    if (!suggestions) {
        wrapper.innerHTML = emptySuggestionElem();
    } else if (suggestions.length === 0) {
        wrapper.innerHTML = noResultSuggestionElem();
    } else if (suggestions.length === 1) {
        const mainSuggestion = suggestions[0];
        game.setSelectedArticleId(mainSuggestion.article_id);
        wrapper.innerHTML = mainSuggestionElem(mainSuggestion, []);
    } else {
        const mainSuggestion = suggestions[0];
        game.setSelectedArticleId(mainSuggestion.article_id);
        wrapper.innerHTML = mainSuggestionElem(mainSuggestion, suggestions.slice(1, suggestions.length));
    }
        // } else {
    //     const mainSuggestion = mainSuggestionElem(suggestions[0]);
    //     const otherElems = suggestions
    //         .slice(1, suggestions.length)
    //         .map((x) => suggestionElem(x));
    //     const elems = [mainSuggestion, ...otherElems];
    //     wrapper.innerHTML = elems.join('\n');
    // }

    addSuggestionButtonListeners()
}

function tryRenderMainGameMenu() {
    `
    If the initial screen is still showing,
    replace it with the main game menu.
    `
    const msg = document.getElementById('initialMessage');
    if (!msg) return;

    const wrapper = document.getElementById('gameWrapper');
    wrapper.removeChild(msg);

    wrapper.prepend(gameMenu());

    addHeaderButtonListeners();
}

async function handleInput(e) {
    tryRenderMainGameMenu();
    const val = e.target.value;
    if (!val) {
        renderSuggestions(null);
        return;
    }
    const suggestions = await getSuggestions(val);
    renderSuggestions(suggestions);
}

function getMainSuggestion() {
    const matches = document.getElementsByClassName('mainSuggestion');
    return matches[0];
}

function handleSubmitButton() {
    game.guess();
    clearInput();
    focusInput();
}

function handleKeyPress(e) {
    if (e.key === 'Enter') {
        handleSubmitButton();
    }
}

function focusInput() {
    const input = document.getElementById('gameInput');
    input.focus();
}

function clearInput() {
    const input = document.getElementById('gameInput');
    input.value = '';
}

function addInitialEventListeners() {
    // Handle text input.
    const input = document.getElementById('gameInput');
    input.addEventListener('input', (e) => handleInput(e));

    // Handle guess submit.
    const submit = document.getElementById('submitButton');
    submit.addEventListener('click', () => handleSubmitButton());
    document.addEventListener('keydown', (e) => handleKeyPress(e));
}

function addSuggestionButtonListeners() {
    const buttons = document.getElementsByClassName('suggestionButton');
    for (const button of buttons) {
        button.addEventListener('click', () => {
            game.setSelectedArticleId(button.id);
            handleSubmitButton();
        })
    }
}

function addHeaderButtonListeners() {
    // Handle best / recent buttons.
    const bestButton = document.getElementById('bestButton');
    const recentButton = document.getElementById('recentButton');
    bestButton.addEventListener('click', () => {
        bestButton.classList.add('gameHeaderButtonSelected');
        recentButton.classList.remove('gameHeaderButtonSelected');
        game.mode = 'best';
        game.render();
    })
    recentButton.addEventListener('click', () => {
        recentButton.classList.add('gameHeaderButtonSelected');
        bestButton.classList.remove('gameHeaderButtonSelected');
        game.mode = 'recent';
        game.render();
    })
}

function renderWinScreen() {
    const winElem = winScreen();
    const parent = document.getElementById('gameWrapper');
    parent.appendChild(winElem);

    const shareButton = document.getElementById('shareButton');
    shareButton.addEventListener('click', () => {
        console.log(game.getWinString())
    });

    const closeButton = document.getElementById('closeButton');
    closeButton.addEventListener('click', () => {
        parent.removeChild(winElem);
    });
}

function renderDisabledScreen() {
    const winElem = disabledScreen();
    const parent = document.getElementById('gameWrapper');
    parent.appendChild(winElem);
}

async function test() {
    // const val = 'te'
    // const suggestions = await getSuggestions(val);
    // renderSuggestions(suggestions);
    // handleSubmitButton();

    // renderWinScreen();
}

function main() {
    addInitialEventListeners();
    focusInput();

    // console.log('clear()')
    // localStorage.clear();

    test();
}


let game = new Game();
main();

// handleInput({
//     target: {
//         value: 'te'
//     }
// });

