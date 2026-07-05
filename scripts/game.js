import { testGuess } from "./config.js";
import { guessArticle } from "./fetchData.js";
import { chunkElem, resultBoxElem } from "./templates.js";
import { cleanTitle } from "./utilities.js";

class ChunkBox {
    constructor() {
        this.chunks = [];
    }

    addChunks(chunks, articleId) {
        const guessOrder = this.chunks.length;
        for (const chunk of chunks) {
            const chunkObj = new Chunk(chunk);
            chunkObj.article_id = articleId;
            chunkObj.guessOrder = guessOrder;
            this.chunks.push(chunkObj);
        }
    }

    __sortByOrder(chunks) {
        console.log(chunks);
        chunks.sort((a, b) => b.guessOrder - a.guessOrder)
    }

    __sortByDistance(chunks) {
        chunks.sort((a, b) => a.distance - b.distance);
    }  

    render(mode) {
        const chunkWrapper = document.getElementById('gameChunkWrapper');
        
        const chunkCopy = [...this.chunks];
        if (mode === 'best') {
            this.__sortByDistance(chunkCopy);
        } else {
            this.__sortByOrder(chunkCopy);
        }

        const elem = chunkCopy
            .map((chunk) => chunkElem(chunk))
            .join('\n');
        chunkWrapper.innerHTML = elem;
    }
}

// article_id: -1
// chunk: "accident in U.S. history when two passenger trains collided head on in Nashville, killing 101 and injuring 171.[143] On August 18, 1920, Tennessee became the 36th and final state necessary to ratify the Nineteenth Amendment to the United States Constitution,"
// chunk_id: 12725916
// count: -1
// distance: 0.37336244661175766
// is_win: false
// title: "tennessee"
// url: "https://en.wikipedia.org/wiki/Tennessee"
class Chunk {
    constructor({ article_id, chunk_id, chunk, count, distance, title, url }) {
        this.article_id = article_id;
        this.chunk_id = chunk_id;
        this.chunk = chunk;
        this.count = count;
        this.distance = distance;
        this.title = title;
        this.url = url;
        this.guessOrder = -1;  // Order for the guess, not the chunk.
    }
}

export class Game {
    constructor() {
        this.isWin = false;
        this.mode = 'best';  // best | recent
        this.guessedArticleIds = new Set();
        this.bestGuessTitle = '';
        this.bestGuessDistance = Infinity;
        this.selectedArticleId = -1;
        this.chunkBox = new ChunkBox();
    }

    getWinString() {
        return `
            I solved the Paragraphle!
            Guesses: ${this.guessedArticleIds.size}
            Average Player: 83 
            My Rank: 75th Percentile (2 Of 8 Players)
        `;
    }

    setSelectedArticleId(articleId) {
        this.selectedArticleId = articleId;
    }

    __checkWin(chunks) {
        this.isWin = chunks
            .map((chunk) => chunk.is_win)
            .reduce((a, b) => a | b);
    }

    __saveGuessResult(chunks) {
        const chunksCopy = [...chunks];
        chunksCopy.sort((a, b) => a.distance - b.distance);
        const topChunk = chunksCopy[0];

        const closestDistance = (topChunk.distance * 100).toFixed();
        this.bestGuessDistance = closestDistance;

        const title = cleanTitle(topChunk.title);
        this.bestGuessTitle = title;
    }

    __addChunks(chunks) {
        this.chunkBox.addChunks(chunks, this.selectedArticleId);
    }

    render() {
        this.chunkBox.render(this.mode);

        const wrapper = document.getElementById('suggestionDiv');
        wrapper.innerHTML = resultBoxElem(this.bestGuessDistance, this.bestGuessTitle);
    }

    async guess() {
        if (
            this.selectedArticleId === -1 ||
            this.guessedArticleIds.has(this.selectedArticleId) ||
            this.isWin
        ) {
            return false;
        }

        const result = await guessArticle(this.selectedArticleId);
        // const result = testGuess;
        this.__checkWin(result.chunks);

        this.guessedArticleIds.add(this.selectedArticleId);

        this.__addChunks(result.chunks);
        this.__saveGuessResult(result.chunks);

        this.render();
    }
}