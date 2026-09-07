
export const html = String.raw;

export function updateClassName(id, value) {
    const elem = document.getElementById(id);
    if (!elem) {
        return 
    }
    elem.className = value;
}

export function getDayStartEasternMilli() {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const dateString = formatter.format(now); 
    const [year, month, day] = dateString.split("-").map(Number);

    const midnightET = new Date(
    Date.UTC(year, month - 1, day) 
    );

    const offsetMinutes = -midnightET.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).includes("EST") ? 300 : 240;
    return midnightET.getTime() + offsetMinutes * 60 * 1000;
}

export function calculateDailyNumber() {
    const MILLISECONDS_PER_DAY = 24 * 3600 * 1000;
    const GAME_EPOCH = 20287;
    const dayStartEasternMilli = getDayStartEasternMilli();
    const index = Math.floor(dayStartEasternMilli / MILLISECONDS_PER_DAY) - GAME_EPOCH;
    return index
}

