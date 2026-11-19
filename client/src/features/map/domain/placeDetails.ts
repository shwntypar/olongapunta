// Everything OpenStreetMap knows about a place, read from its tags into
// labelled fields the place card can show. OSM coverage in Olongapo is
// uneven: most places have a name and type, far fewer an address, and only
// a handful hours or contacts, so every field here is optional.

export interface PlaceFact {
  label: string;
  value: string;
}

export interface PlaceDetails {
  /** Street address from addr:* tags; undefined if OSM only knows the city. */
  address?: string;
  /** "Olongapo, Zambales" — when there's no street address, at least the area. */
  area?: string;
  /** "189 Olongapo-Bugallon Road" — house number and street only. */
  street?: string;
  /** Barangay / village / neighbourhood from the address, if tagged. */
  barangay?: string;
  phones: string[];
  email?: string;
  website?: string;
  facebook?: string;
  /** Raw OSM opening_hours text (see openingHours.ts to read it). */
  openingHours?: string;
  brand?: string;
  branch?: string;
  operator?: string;
  /** "Public", "Private", "Government", … */
  ownership?: string;
  cuisine: string[];
  description?: string;
  /** Other names the place goes by (English/Filipino name, official, former, short). */
  otherNames: string[];
  /** Everything else worth showing, as label/value pairs. */
  facts: PlaceFact[];
  /** For "View on OpenStreetMap" / "Suggest an edit". */
  osm: { type: "node" | "way" | "relation"; id: number };
}

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const list = (v?: string) => (v ? v.split(";").map((x) => x.trim()).filter(Boolean) : []);
const yesNo = (v?: string) => (v === "yes" ? "Yes" : v === "no" ? "No" : v === "only" ? "Only" : v ? titleCase(v) : undefined);

function withScheme(url?: string): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, "")}`;
}

function facebookUrl(v?: string): string | undefined {
  if (!v) return undefined;
  return /facebook\.com|fb\.com/i.test(v) ? withScheme(v) : `https://www.facebook.com/${v.replace(/^@/, "")}`;
}

/** ISCED levels → Philippine school levels. */
const SCHOOL_LEVEL: Record<string, string> = {
  "0": "Preschool",
  "1": "Elementary",
  "2": "Junior High School",
  "3": "Senior High School",
  "4": "Post-secondary",
  "5": "College",
  "6": "College",
  "7": "Graduate school",
  "8": "Graduate school",
};

function schoolLevels(isced?: string): string | undefined {
  if (!isced) return undefined;
  const levels = new Set<string>();
  for (const part of isced.split(/[;,]/)) {
    const [a, b] = part.trim().split("-").map(Number);
    if (isNaN(a)) continue;
    for (let l = a; l <= (isNaN(b) ? a : b); l++) if (SCHOOL_LEVEL[String(l)]) levels.add(SCHOOL_LEVEL[String(l)]);
  }
  return levels.size ? [...levels].join(", ") : undefined;
}

const PAYMENT_NAMES: Record<string, string> = { cash: "Cash", gcash: "GCash", maya: "Maya", paymaya: "Maya", credit_cards: "Credit card", debit_cards: "Debit card", visa: "Visa", mastercard: "Mastercard" };

function buildAddress(t: Record<string, string>) {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const corner = t["addr:street:corner"] ? `cor. ${t["addr:street:corner"]}` : "";
  const barangay = t["addr:barangay"] || t["addr:village"] || t["addr:neighbourhood"] || t["addr:suburb"] || t["addr:quarter"] || t["addr:place"];
  const city = (t["addr:city"] || t["addr:town"] || "").trim();
  const province = t["addr:province"];
  const postcode = t["addr:postcode"];
  const area = [city, province].filter(Boolean).join(", ");
  const local = [t["addr:full"], [street, corner].filter(Boolean).join(" "), barangay].filter(Boolean).join(", ");
  return {
    address: local ? [local, [area, postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ") : undefined,
    area: area || undefined,
    street: [street, corner].filter(Boolean).join(" ") || undefined,
    barangay: barangay || undefined,
  };
}

export function placeDetailsFromTags(tags: Record<string, string>, osm: PlaceDetails["osm"]): PlaceDetails {
  const t = tags;
  const { address, area, street, barangay } = buildAddress(t);
  const facts: PlaceFact[] = [];
  const fact = (label: string, value?: string) => {
    if (value) facts.push({ label, value });
  };

  // Schools
  fact("Level", schoolLevels(t["isced:level"]));
  fact("Grades", t.grades);
  const pupilsYear = Object.keys(t)
    .filter((k) => k.startsWith("population:pupils:"))
    .sort()
    .pop();
  if (pupilsYear) fact(`Pupils (${pupilsYear.split(":").pop()})`, Number(t[pupilsYear]).toLocaleString("en-US"));

  // Health
  if (t.healthcare && t.healthcare !== t.amenity) fact("Healthcare", titleCase(t.healthcare));
  fact("Speciality", list(t["healthcare:speciality"]).map(titleCase).join(", ") || undefined);
  fact("Emergency", yesNo(t.emergency));
  fact("Beds", t.beds);

  // Money
  fact("ATM", yesNo(t.atm));
  fact("Money transfer", list(t.money_transfer).map(titleCase).join(", ") || undefined);
  const payments = Object.keys(t)
    .filter((k) => k.startsWith("payment:") && t[k] === "yes")
    .map((k) => PAYMENT_NAMES[k.slice(8)] ?? titleCase(k.slice(8)));
  fact("Payment", payments.join(", ") || undefined);

  // Food and services
  fact("Takeaway", yesNo(t.takeaway));
  fact("Delivery", yesNo(t.delivery));
  fact("Drive-through", yesNo(t.drive_through));
  fact("Outdoor seating", yesNo(t.outdoor_seating));
  fact("Air conditioning", yesNo(t.air_conditioning));
  fact("Internet", t.internet_access === "wlan" ? "Wi-Fi" : yesNo(t.internet_access));
  fact("Wheelchair access", yesNo(t.wheelchair));
  fact("Stars", t.stars);
  fact("Rooms", t.rooms);

  // Government
  fact("Office", t["townhall:type"] ? `${titleCase(t["townhall:type"])} hall` : undefined);

  // Building
  fact("Floor", t.level);
  fact("Established", t.start_date);

  const otherNames = [t["name:en"], t["name:tl"], t.official_name, t.alt_name, t.short_name, t.old_name && `formerly ${t.old_name}`]
    .filter((n): n is string => !!n && n !== t.name);

  const ownership = t["operator:type"] ? titleCase(t["operator:type"]) : undefined;
  const brand = t.brand && t.brand !== t.name ? t.brand : undefined;

  return {
    address,
    area,
    street,
    barangay,
    phones: [...list(t.phone), ...list(t["contact:phone"]), ...list(t.mobile), ...list(t["contact:mobile"])],
    email: t.email || t["contact:email"],
    website: withScheme(t.website || t["contact:website"] || t.url),
    facebook: facebookUrl(t["contact:facebook"] || t.facebook || t["brand:facebook"]),
    openingHours: t.opening_hours,
    brand,
    branch: t.branch,
    operator: t.operator && t.operator !== t.name && t.operator !== t.brand ? t.operator : undefined,
    ownership,
    cuisine: list(t.cuisine).map(titleCase),
    description: t.description,
    otherNames: [...new Set(otherNames)],
    facts,
    osm,
  };
}

/** Text a search should also match: brand, cuisine, address, other names. */
export function detailsSearchText(details?: PlaceDetails): string {
  if (!details) return "";
  return [details.brand, details.branch, details.operator, details.address, ...details.cuisine, ...details.otherNames].filter(Boolean).join(" ").toLowerCase();
}
