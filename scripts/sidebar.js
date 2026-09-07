import { URI } from "./config.js";

export function sidebar() {
    openMenuIconListener();
    closedMenuIconListener();
    sidebarListener();
    exitButtonListener();
    playerCountMonitor();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden')
    } else {
        sidebar.classList.add('hidden')
    }
    monitoringPlayerCount = !sidebar.classList.contains('hidden');
    if (monitoringPlayerCount) updatePlayerCount();
}

function openMenuIconListener() {
    const menuIconOpen = document.getElementById('menuIconOpen');
    if (!menuIconOpen) return;
    menuIconOpen.addEventListener('click', toggleSidebar)
}

function exitButtonListener() {
    const exitButton = document.getElementById('exitButton');
    if (!exitButton) return;
    exitButton.addEventListener('click', (e) => toggleSidebar());
}

function closedMenuIconListener() {
    const menuIconClosed = document.getElementById('menuIconClosed');
    if (!menuIconClosed) return;
    menuIconClosed.addEventListener('click', toggleSidebar)
}

function sidebarListener() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.addEventListener('click', (e) => {
        const div = e.target;
        if (div.id !== 'sidebar') return;
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        if (sidebar.classList.contains('hidden')) {
            sidebar.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
        }
    })
}

function updateStat(id, val) {
    if (val === -1) return;
    const elem = document.getElementById(id);
    if (!elem) return;
    elem.innerHTML = String(val.toFixed(0));
}


async function updatePlayerCount() {
    const response = await fetch(`${URI}/stats`);
    if (!response.ok) return null;
    const stats =  await response.json();
    if (!stats) return;

    updateStat('meanGuessesPerWin', stats.mean_guesses_per_win);
    updateStat('winCount', stats.win_count);
    updateStat('dailyGuessCount', stats.guess_count);
    updateStat('playCount', stats.play_count);
}

async function playerCountMonitor() {
    while (true) {
        if (monitoringPlayerCount) updatePlayerCount();
        await sleepCallback(10000);
    }
}

function sleepCallback(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let monitoringPlayerCount = false;
