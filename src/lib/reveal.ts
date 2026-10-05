// Sections 02–04 start folded: a <details class="fold"> inside each section, so their content is in the page (and in
// find-in-page) but out of the way. Anything that sends the reader somewhere opens the folds around it first, so a link,
// a company page or an "open field notes" button never lands on a closed section. Open/closed isn't remembered.

/** Open the fold inside `el` (when it's a folded section) and every fold around it. */
export function unfold(el: Element | null) {
  if (!el) return null;
  const inner = el.querySelector(":scope > details.fold");
  if (inner instanceof HTMLDetailsElement) inner.open = true;
  for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
  return el;
}

/** Open what `id` points at, then bring it into view. */
export function reveal(id: string, behavior: ScrollBehavior = "smooth") {
  unfold(document.getElementById(id))?.scrollIntoView({ behavior, block: "start" });
}

const target = (hash: string) => (hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null);

/**
 * Same-page links (the contents, "#roles" chips) and typed or shared hashes open their target. Clicks are caught
 * before the browser follows the link, so it scrolls to the opened content. Returns the cleanup.
 */
export function unfoldOnNavigate() {
  const onHash = () => unfold(target(window.location.hash));
  const onClick = (e: MouseEvent) => {
    const a = e.target instanceof Element ? e.target.closest("a[href^='#']") : null;
    if (a) unfold(target(a.getAttribute("href")!));
  };
  // A shared link to something inside a fold (#field-notes) couldn't be scrolled to before it opened.
  const first = target(window.location.hash);
  const hidden = first !== null && first.getClientRects().length === 0;
  unfold(first);
  if (hidden) first.scrollIntoView({ block: "start" });
  window.addEventListener("hashchange", onHash);
  document.addEventListener("click", onClick, true);
  return () => {
    window.removeEventListener("hashchange", onHash);
    document.removeEventListener("click", onClick, true);
  };
}
