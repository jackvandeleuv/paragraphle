interface StatsUpdate {
    current_users: number;
	mean_guesses_per_win: number;
    win_count: number;
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

async function updatePlayerCount() {
    const response = await fetch(`${URI}/stats`);
    if (!response.ok) return null;
    const stats =  await response.json() as StatsUpdate;
    if (!stats) return;

    const playerCount = document.getElementById('playerCount');
    if (!playerCount) return;
    playerCount.innerHTML = String(stats.current_users);

    const solveCount = document.getElementById('solveCount');
    if (!solveCount) return;
    solveCount.innerHTML = String(stats.win_count);

    const averageScore = document.getElementById('averageScore');
    if (!averageScore) return;
    if (stats.mean_guesses_per_win === -1) {
        averageScore.innerHTML = '...';
    } else {
        averageScore.innerHTML = String(stats.mean_guesses_per_win.toFixed(0));
    }
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
let monitoringPlayerCount = false;
sidebar();