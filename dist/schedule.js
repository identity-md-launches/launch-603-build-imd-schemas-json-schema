"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intervalMinutes = intervalMinutes;
exports.cronMinimumMinutes = cronMinimumMinutes;
/** Deterministic cadence checks; UTC calendar arithmetic is independent of the host timezone. */
function intervalMinutes(value) {
    value = value.replace(/,/g, '.');
    const week = /^P(\d+(?:\.\d+)?)W$/.exec(value);
    if (week)
        return Number(week[1]) * 10080;
    const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
    if (!match || !match.slice(1).some(Boolean) || value.endsWith('T'))
        return undefined;
    // ISO 8601 allows a fraction only on the smallest component present.
    const components = match.slice(1).filter(Boolean);
    if (components.slice(0, -1).some(part => part.includes('.')))
        return undefined;
    return Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + Number(match[4] || 0) / 60;
}
function field(text, low, high, names = []) {
    text = text.toUpperCase();
    names.forEach((name, i) => { text = text.replace(new RegExp(name, 'g'), String(i + low)); });
    const values = new Set();
    for (const item of text.split(',')) {
        const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(item);
        if (!match)
            throw new Error('must be a valid five-field cron expression');
        const step = Number(match[2] || 1);
        if (step < 1 || step > high - low + 1)
            throw new Error('cron step is out of range');
        const [start, end] = match[1] === '*' ? [low, high] : match[1].includes('-') ? match[1].split('-').map(Number) : [Number(match[1]), match[2] ? high : Number(match[1])];
        if (start < low || end > high || start > end)
            throw new Error('cron field is out of range');
        for (let n = start; n <= end; n += step)
            values.add(n);
    }
    return [...values].sort((a, b) => a - b);
}
function cronMinimumMinutes(cron) {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5)
        throw new Error('must be a valid five-field cron expression');
    const minutes = field(parts[0], 0, 59);
    const hours = field(parts[1], 0, 23);
    const days = field(parts[2], 1, 31);
    const months = field(parts[3], 1, 12, ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']);
    const weekdays = field(parts[4], 0, 7, ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']).map(n => n % 7);
    const times = hours.flatMap(hour => minutes.map(minute => hour * 60 + minute));
    let minimum = Infinity;
    for (let i = 1; i < times.length; i++)
        minimum = Math.min(minimum, times[i] - times[i - 1]);
    // Every Gregorian calendar pattern recurs within 400 years. Only first/last
    // daily times matter for gaps across dates; no minute-by-minute scanning.
    let previousDay;
    let firstDay;
    const start = Date.UTC(2000, 0, 1);
    const cycleDays = 146097;
    for (let offset = 0; offset < cycleDays; offset++) {
        const date = new Date(start + offset * 86400000);
        if (!months.includes(date.getUTCMonth() + 1))
            continue;
        const dayMatch = days.includes(date.getUTCDate());
        const weekdayMatch = weekdays.includes(date.getUTCDay());
        // Traditional cron: restricted day-of-month and day-of-week combine with OR.
        const matches = parts[2].startsWith('*') ? weekdayMatch && dayMatch : parts[4].startsWith('*') ? dayMatch && weekdayMatch : dayMatch || weekdayMatch;
        if (!matches)
            continue;
        if (firstDay === undefined)
            firstDay = offset;
        if (previousDay !== undefined)
            minimum = Math.min(minimum, (offset - previousDay) * 1440 + times[0] - times[times.length - 1]);
        previousDay = offset;
        if (minimum === 1)
            return minimum;
    }
    if (firstDay === undefined || previousDay === undefined)
        throw new Error('cron has no matching calendar date');
    return Math.min(minimum, (firstDay + cycleDays - previousDay) * 1440 + times[0] - times[times.length - 1]);
}
