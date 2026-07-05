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

function titleCase(str) {
    return str
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function cleanTitle(title) {
    return titleCase(title || '');
}
