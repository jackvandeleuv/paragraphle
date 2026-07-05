import { cleanTitle } from "./utilities.js";

export const suggestionElem = (suggestion) => {
    const title = cleanTitle(suggestion.title);
    return `
        <div 
            class="suggestion otherSuggestion" 
            id=${suggestion.article_id}
        >
            ${title}
        </div>
    `
}

const otherSuggestionButton = (suggestion) => {
    const title = cleanTitle(suggestion.title);

    return `
        <button id="${suggestion.article_id}" class="suggestionButton">
            ${title}?
        </button>
    `
}

export const mainSuggestionElem = (suggestion, otherSuggestions) => {
    const mainTitle = cleanTitle(suggestion.title);
    const buttons = otherSuggestions
        .map((s) => otherSuggestionButton(s))
        .join('<p class="suggestionButtonDivider">|</p>');
    return `
        <div 
            class="resultBox" 
        >
            Your Guess Is:
            <h1>
                ${mainTitle}?
            </h1>
            <div id="suggestionButtonWrapper">
                ${buttons}
            </div>
        </div>
    `
}

export const emptySuggestionElem = () => {
    return `
        <div 
            class="resultBox" 
        >
            <h1>
                Guess an article!
            </h1>
        </div>
    `
}

export const noResultSuggestionElem = () => {
    return `
        <div 
            class="resultBox" 
        >
            <h1>
                No articles found!
            </h1>
        </div>
    `
}

export const resultBoxElem = (closestDistance, title) => {
    return `
        <div 
            class="resultBox" 
        >
            <h1>
                ${title}
            </h1>
            <p class="italicSubtitle">
                Distance: ${closestDistance} miles
            </p>
        </div>
    `
}


export const chunkElem = (chunk) => {
    const title = cleanTitle(chunk.title);
    const score = (chunk.distance * 100).toFixed();
    return `
        <div class="chunk">
            <div class="chunkHeader">
                <h4>${title}</h4>
                <h4>${score} miles</h4>
            </div>
            <hr class="chunkHR">
            <p>
                ${chunk.chunk}
            </p>
        </div>
    `
}

export const winScreen = () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'winScreenWrapper';
    wrapper.innerHTML = `
        <div id="winScreen">
            <button id="closeButton" class="closeButtonWrapper">
                <svg class="closeButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
                </svg>
            </button>
            <div id="winScreenTitleWrapper">
                <h1 class="winScreenTitle">⭐</h1>
                <h1 class="winScreenTitle">Victory!</h1>
            </div>
            <button id="shareButton">
                Share
            </button>
        </div>
    `;
    return wrapper;
}

export const disabledScreen = () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'winScreenWrapper';
    wrapper.innerHTML = `
        <div id="disabledScreen">
            <h1 class="winScreenTitle">
                Game Unavailable
            </h1>
            <h3>
                Paragraphle is currently undergoing maintenance. Please check back later.
            </h3>
        </div>
    `;
    return wrapper;
}

export const gameMenu = () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'gameMenu';
    wrapper.innerHTML = `
        <div id="suggestionDiv">
        </div>

        <div id="gameChunkDivider">
            <hr>
        </div>

        <div id="progressDiv">
            <div id="lastLabelWrapper">
                <p id="lastLabel">Tennesee</p>
                <div class="carrotDown"></div>
            </div>
            <div id="progressDivBarWrapper">
                <div id="progressDivBar">
                    <hr class="progressDivBarHR">
                </div>
                <div id="winLabel">
                    Win
                </div>
            </div>
            <div id="bestLabelWrapper">
                <div class="carrotUp"></div>
                <p id="bestLabel">United States</p>
            </div>
        </div>

        <div id="gameHeaderButtonWrapper">
            <button id="bestButton" class="gameHeaderButton gameHeaderButtonSelected">
                <svg class="gameHeaderButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                    <path d="M320-120v-240H120l360-440 360 440H640v240H320Zm80-80h160v-240h111L480-674 289-440h111v240Zm80-240Z"/>
                </svg>
                Best
            </button>
            <button id="recentButton" class="gameHeaderButton">
                <svg class="gameHeaderButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                    <path d="M480-80q-155 0-269-103T82-440h81q15 121 105.5 200.5T480-160q134 0 227-93t93-227q0-134-93-227t-227-93q-86 0-159.5 42.5T204-640h116v80H88q29-140 139-230t253-90q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm112-232L440-464v-216h80v184l128 128-56 56Z"/>
                </svg>
                Recent
            </button>
        </div>

        <div id="gameChunkWrapper">
        </div>
    `;
    return wrapper;
}