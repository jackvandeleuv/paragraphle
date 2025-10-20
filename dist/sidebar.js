"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function sidebar() {
    openMenuIconListener();
    closedMenuIconListener();
    sidebarListener();
    exitButtonListener();
    playerCountMonitor();
}
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar)
        return;
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
    }
    else {
        sidebar.classList.add('hidden');
    }
    monitoringPlayerCount = !sidebar.classList.contains('hidden');
    if (monitoringPlayerCount)
        updatePlayerCount();
}
function openMenuIconListener() {
    const menuIconOpen = document.getElementById('menuIconOpen');
    if (!menuIconOpen)
        return;
    menuIconOpen.addEventListener('click', toggleSidebar);
}
function exitButtonListener() {
    const exitButton = document.getElementById('exitButton');
    if (!exitButton)
        return;
    exitButton.addEventListener('click', (e) => { console.log(e); toggleSidebar(); });
}
function closedMenuIconListener() {
    const menuIconClosed = document.getElementById('menuIconClosed');
    if (!menuIconClosed)
        return;
    menuIconClosed.addEventListener('click', toggleSidebar);
}
function sidebarListener() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar)
        return;
    sidebar.addEventListener('click', (e) => {
        const div = e.target;
        if (div.id !== 'sidebar')
            return;
        const sidebar = document.getElementById('sidebar');
        if (!sidebar)
            return;
        if (sidebar.classList.contains('hidden')) {
            sidebar.classList.remove('hidden');
        }
        else {
            sidebar.classList.add('hidden');
        }
    });
}
function updateStat(id, val) {
    if (val === -1)
        return;
    const elem = document.getElementById(id);
    if (!elem)
        return;
    console.log(id, val);
    console.log(elem);
    elem.innerHTML = String(val.toFixed(0));
}
function updatePlayerCount() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`${URI}/stats`);
        if (!response.ok)
            return null;
        const stats = yield response.json();
        if (!stats)
            return;
        updateStat('currentUsers', stats.current_users);
        updateStat('meanGuessesPerWin', stats.mean_guesses_per_win);
        updateStat('winCount', stats.win_count);
        updateStat('dailyGuessCount', stats.guess_count);
        updateStat('playCount', stats.play_count);
    });
}
function playerCountMonitor() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            if (monitoringPlayerCount)
                updatePlayerCount();
            yield sleepCallback(10000);
        }
    });
}
function sleepCallback(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// const URI = 'https://api.paragraphle.com';
const URI = 'http://localhost:8000';
let monitoringPlayerCount = false;
sidebar();
