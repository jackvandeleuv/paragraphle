import { initGame } from "./game.js";
import { sidebar } from "./sidebar.js";

function main() {
    sidebar();

    const pathName = window.location.pathname;
    if (pathName != '/play') return;
    initGame();
}

main();
