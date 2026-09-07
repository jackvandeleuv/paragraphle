import { updateInnerHTML } from "./game.js";
import { calculateDailyNumber, html, updateClassName } from "./utils.js";

function shareButtonListener(text) {
    const button = document.getElementById('shareButton');
    button.classList.remove('bg-slate-600')
    button.classList.remove('border-slate-600')
    button.classList.add('bg-orange-800/60');
    button.classList.add('border-orange-800/60');
    button.innerHTML = `
        <svg class="copyIconChecked" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
        </svg>
        <p class="shareButtonText"> 
            Copied
        </p>
    `;
    navigator.clipboard.writeText(text);
}

const shareButtonText = (guessCount, winRank, winPercentile, playTime, playersWhoWon) => {
    const dailyNumber = calculateDailyNumber();
    return `Paragraphle #${dailyNumber}
📈 Score: ${guessCount} guesses
🏅 Rank:  Top ${winRank} (${winPercentile}%) of ${playersWhoWon} players
🕙 Time:  ${playTime} minutes`;
}

const winModal = (winningArticle, game) => {
    const winPercentile = Math.round((100 * game.winRank) / game.playersWhoWon, 1)
    const playTime = (game.play_time_ms / (1000 * 60)).toFixed(1)

    const buttonText = shareButtonText(
        game.guessCount, 
        game.winRank, 
        winPercentile, 
        playTime, 
        game.playersWhoWon
    );

    const winModalWrapper = document.createElement('div');
    winModalWrapper.id = 'winModalWrapper'

    winModalWrapper.innerHTML = `
        <div id="closeButtonWrapper">
            <svg id="closeButton" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
            </svg>
        </div>
    `;
    
    const winModal = document.createElement('div');
    winModal.id = 'winModal'

    winModal.innerHTML = html`
        <div id="winModalHeader">
            <h2 id="winModalTitle">
                Bravo!
            </h2>    
            <p id="winModalAnswer">
                The answer was:
                <span id="winModalAnswerName">${winningArticle}</span>
            </p>
        </div>
        <div class="winModalBox">
            <p>📈 Score:</p>
            <p>${game.guessCount} guesses</p>
        </div>
        <div class="winModalBox">
            <p>🏅 Rank:</p>
            <p>Top ${game.winRank} (${winPercentile}%) of ${game.playersWhoWon} players</p>
        </div>
        <div class="winModalBox">
            <p>🕙 Time:</p>
            <p>${playTime} minutes</p>
        </div>
    `;

    const button = document.createElement('button');
    button.innerHTML = `
        <svg class="copyIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
            <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
        </svg>
        <p class="shareButtonText"> 
            &nbspShare&nbsp
        </p>
    `
    button.id = 'shareButton';
    button.className = `
        inline-flex items-center justify-center px-2 py-1 rounded-md
        bg-slate-600 text-white text-xs md:text-base font-semibold tracking-wide
        transition-colors border-2 rounded-md border-slate-600
    `;
    button.addEventListener('click', () => shareButtonListener(buttonText))
    winModal.appendChild(button);

    winModalWrapper.appendChild(winModal);

    return winModalWrapper;
}

function addCloseButtonListener() {
    const closeButton = document.getElementById('closeButton');
    const winModalElem = document.getElementById('winModalWrapper');
    closeButton.addEventListener('click', () => {
        winModalElem.style.display = 'none';
    })
}

function renderWinModal(winningArticle, game) {
    const body = document.getElementById('body');
    body.appendChild(winModal(winningArticle, game));

    addCloseButtonListener();
}

export async function renderWin(title, imageURL, game) {
    updateClassName('progressBar', `h-full bg-orange-800/60 w-full`);   

    updateInnerHTML('lastGuessDistance', `Score: 100%`);

    updateClassName('lastGuessBox', `
        flex flex-col items-center justify-between text-sm md:text-base font-semibold
        px-3 py-1 rounded border border-orange-800/60
        bg-orange-800/60 text-white
    `);

    renderWinModal(title, game);
}
