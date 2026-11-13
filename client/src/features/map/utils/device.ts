/**
 * Phones and tablets have real GPS. Desktop browsers only guess a location
 * from IP/Wi-Fi databases (often a whole city off), so on desktop the origin
 * is set by dropping a pin instead.
 */
export function isMobileDevice(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
