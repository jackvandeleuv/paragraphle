interface StatsUpdate {
    current_users: number;
	mean_guesses_per_win: number;
    win_count: number;
    guess_count: number;
    play_count: number;
}

function sidebar() {
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
    exitButton.addEventListener('click', (e) => {console.log(e); toggleSidebar()})
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
        const div = e.target as HTMLDivElement;
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

function updateStat(id: string, val: number) {
    if (val === -1) return;
    const elem = document.getElementById(id);
    if (!elem) return;
    console.log(id, val)
    console.log(elem)
    elem.innerHTML = String(val.toFixed(0));
}


async function updatePlayerCount() {
    const response = await fetch(`${URI}/stats`);
    if (!response.ok) return null;
    const stats =  await response.json() as StatsUpdate;
    if (!stats) return;

    updateStat('currentUsers', stats.current_users);
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

function sleepCallback(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const URI = 'https://api.paragraphle.com';
// const URI = 'http://localhost:8000';

let monitoringPlayerCount = false;
sidebar();