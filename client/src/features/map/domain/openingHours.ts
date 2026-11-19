// OpenStreetMap opening_hours → a readable weekly schedule and "open now".
//
// Supports the forms found in Olongapo's data: "24/7", "Mo-Su 09:00-22:00",
// several rules separated by ";" (a later rule overrides earlier ones for
// the days it names), day lists ("Mo,We,Fr"), several time ranges
// ("08:00-12:00,13:00-17:00"), "off"/"closed", a time range with no days
// (= every day), and closing after midnight ("09:00-02:00"). Anything else
// returns null, and the raw text is shown instead of guessing.

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Minutes from midnight; an end above 1440 runs past midnight into the next day. */
export interface TimeRange {
  start: number;
  end: number;
}

/** Index 0 = Monday … 6 = Sunday. An empty list = closed that day. */
export type WeekSchedule = TimeRange[][];

const parseTime = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 24 && min < 60 ? h * 60 + min : null;
};

function parseDays(spec: string): number[] | null {
  const days = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-");
    const from = DAYS.indexOf(a as (typeof DAYS)[number]);
    const to = b === undefined ? from : DAYS.indexOf(b as (typeof DAYS)[number]);
    if (from < 0 || to < 0) return null;
    for (let d = from; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === to) break;
    }
  }
  return [...days];
}

function parseRanges(spec: string): TimeRange[] | null {
  const ranges: TimeRange[] = [];
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-");
    const start = parseTime(a?.trim() ?? "");
    let end = parseTime(b?.trim() ?? "");
    if (start === null || end === null) return null;
    if (end <= start) end += 24 * 60; // closes after midnight
    ranges.push({ start, end });
  }
  return ranges;
}

/** The weekly schedule, or null if the text uses a form this parser doesn't know. */
export function parseOpeningHours(raw: string): WeekSchedule | null {
  const text = raw.trim();
  if (!text) return null;
  if (text === "24/7") return DAYS.map(() => [{ start: 0, end: 24 * 60 }]);

  const week: WeekSchedule = DAYS.map(() => []);
  for (const rule of text.split(";").map((r) => r.trim()).filter(Boolean)) {
    const m = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$/.exec(rule);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1]) : DAYS.map((_, i) => i);
    const rest = m[2].trim();
    if (!days) return null;
    if (/^(off|closed)$/i.test(rest)) {
      for (const d of days) week[d] = [];
      continue;
    }
    const ranges = parseRanges(rest);
    if (!ranges) return null;
    for (const d of days) week[d] = ranges;
  }
  return week;
}

function formatTime(minutes: number): string {
  const m = minutes % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

const formatRanges = (ranges: TimeRange[]) =>
  ranges.length === 0
    ? "Closed"
    : ranges.map((r) => (r.start === 0 && r.end === 24 * 60 ? "Open 24 hours" : `${formatTime(r.start)} – ${formatTime(r.end)}`)).join(", ");

/** Groups consecutive days with the same hours: [["Mon–Fri", "8:00 AM – 5:00 PM"], ["Sat–Sun", "Closed"]]. */
export function scheduleLines(week: WeekSchedule): [string, string][] {
  const lines: [string, string][] = [];
  let i = 0;
  while (i < 7) {
    const text = formatRanges(week[i]);
    let j = i;
    while (j + 1 < 7 && formatRanges(week[j + 1]) === text) j++;
    const days = i === 0 && j === 6 ? "Every day" : i === j ? DAY_NAMES[i] : `${DAY_NAMES[i]}–${DAY_NAMES[j]}`;
    lines.push([days, text]);
    i = j + 1;
  }
  return lines;
}

/** Day of week (0 = Monday) and minutes since midnight, in Olongapo's time zone. */
export function manilaNow(date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export interface OpenStatus {
  open: boolean;
  /** e.g. "Closes 10:00 PM", "Opens 9:00 AM", "Open 24 hours" */
  detail: string;
}

/** Whether the place is open at `now`, and when that changes next. */
export function openStatus(week: WeekSchedule, now = manilaNow()): OpenStatus {
  const { day, minutes } = now;
  const yesterday = (day + 6) % 7;
  const todayRanges = week[day];
  if (todayRanges.some((r) => r.start === 0 && r.end === 24 * 60) && week.every((d) => d.some((r) => r.start === 0 && r.end === 24 * 60))) {
    return { open: true, detail: "Open 24 hours" };
  }
  // A range from yesterday that runs past midnight.
  const carry = week[yesterday].find((r) => r.end > 24 * 60 && minutes < r.end - 24 * 60);
  if (carry) return { open: true, detail: `Closes ${formatTime(carry.end)}` };
  const current = todayRanges.find((r) => minutes >= r.start && minutes < r.end);
  if (current) return { open: true, detail: current.end >= 24 * 60 && current.start === 0 ? "Open all day" : `Closes ${formatTime(current.end)}` };

  const later = todayRanges.filter((r) => r.start > minutes).sort((a, b) => a.start - b.start)[0];
  if (later) return { open: false, detail: `Opens ${formatTime(later.start)}` };
  for (let k = 1; k <= 7; k++) {
    const d = (day + k) % 7;
    const first = [...week[d]].sort((a, b) => a.start - b.start)[0];
    if (first) return { open: false, detail: `Opens ${k === 1 ? "tomorrow" : DAY_NAMES[d]} ${formatTime(first.start)}` };
  }
  return { open: false, detail: "Closed" };
}
