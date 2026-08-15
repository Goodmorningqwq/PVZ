// Small helpers shared by the menu screens and the in-game HUD.
//
// All three previously lived un-exported inside Game.tsx, which meant the
// waiting room either couldn't use them (shortId, backToMenu) or reimplemented
// them (the clipboard copy, duplicated almost verbatim — bug included).

// Session ids are long UUIDs meant for the wire, not for a human to read.
// Shorten them for display until real display names exist.
export function shortId(id: string): string {
  return id ? id.slice(0, 8) : '';
}

// Leaves the current match/room entirely and returns to the mode select
// screen. Deliberately a full navigation rather than a phase change: it drops
// every query param (?room, ?solo, ?demo), and those are read once at mount
// via useMemo, so nothing short of a reload can clear them.
export function backToMenu(): void {
  window.location.href = window.location.pathname;
}

// Copies the current URL, resolving to whether it actually worked.
//
// Both previous copies of this swallowed the failure and left the button
// saying "Copy invite link" forever, which is indistinguishable from the click
// not registering. navigator.clipboard is undefined on an insecure origin —
// i.e. anyone testing over plain http on a LAN address — so this is a real
// path, not a theoretical one. Callers can now show the failure.
export async function copyInviteLink(): Promise<boolean> {
  try {
    if (!navigator.clipboard) {
      return false;
    }
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}
