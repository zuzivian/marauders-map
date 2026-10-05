"use client";

import { useEffect, useRef, useState } from "react";
import { companies, hiring, type Company } from "@/data";
import { calPath, feedIds, inOpeningOrder, myListFeed, toCsv, toTsv, trackerRows, webcalUrl } from "@/lib/export";
import { setMyListOnly, toggleStar, useMyListOnly, useStarred } from "@/lib/myList";
import { useGuide } from "./Guide";

// Star companies, narrow the views to them, and send them to the reader's own tracker and calendar.

/** A drawn star (not a glyph), outlined or filled. */
export function StarIcon({ on, size = 13 }: { on: boolean; size?: number }) {
  return (
    <svg className={`star${on ? " on" : ""}`} width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <path d="M6 0.9 L7.5 4.1 L11 4.5 L8.4 6.9 L9.1 10.4 L6 8.7 L2.9 10.4 L3.6 6.9 L1 4.5 L4.5 4.1 Z" strokeLinejoin="round" />
    </svg>
  );
}

/** Star toggle. `chip` sits among other chips; the default is a quiet inline label for headers. */
export function StarButton({ company: c, chip }: { company: Company; chip?: boolean }) {
  const on = useStarred().has(c.id);
  return (
    <button className={chip ? "chip star-chip" : "star-btn"} aria-pressed={on} onClick={() => toggleStar(c.id)}>
      <StarIcon on={on} />{on ? "on my list" : "add to my list"}<span className="sr-only">: {c.name}</span>
    </button>
  );
}

/** A small filled star after a starred company's name; nothing otherwise. */
export function StarMark({ id }: { id: string }) {
  return useStarred().has(id) ? <span className="star-mark"><StarIcon on size={10} /><span className="sr-only"> (on my list)</span></span> : null;
}

/** What a view should show: everyone, or only the starred companies. */
export function useMyListFilter() {
  const only = useMyListOnly(), starred = useStarred();
  return { only, starred, keep: (id: string) => !only || starred.has(id) };
}

export function MyListToggle() {
  const on = useMyListOnly();
  return (
    <button className="chip star-chip" aria-pressed={on} onClick={() => setMyListOnly(!on)}>
      <StarIcon on={on} />my list only
    </button>
  );
}

/** The toggle on its own line, above a chart. Until something is starred it has nothing to narrow to, so it waits. */
export function MyListBar() {
  const { only, starred } = useMyListFilter();
  if (!only && !starred.size) return null;
  return <div className="mylist-bar"><MyListToggle /></div>;
}

/** Shown in place of a view that "my list only" has emptied. */
export function MyListEmpty() {
  const starred = useStarred();
  return (
    <p className="mylist-empty">
      {starred.size
        ? "None of the companies on your list has an MBA internship to show here."
        : "Star companies (in their field notes, or in a row of the timing chart) to build your list; this view then narrows to them."}{" "}
      <button className="linkish" onClick={() => setMyListOnly(false)}>Show everyone</button>
    </p>
  );
}

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exports for the reader's own tools: rows for their tracker, and calendar files. */
export function MyListTools() {
  const { today } = useGuide();
  const starred = useStarred();
  const [said, setSaid] = useState("");
  const ids = inOpeningOrder(starred.size ? starred : companies.map((c) => c.id));
  const calIds = ids.filter((id) => feedIds.includes(id));
  const stem = `marauders-map-${starred.size ? "my-list" : "all"}-${today}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(trackerRows(ids, today)));
      setSaid(`Copied ${ids.length} rows with headers. Paste into Google Sheets, Notion, Airtable or Excel.`);
    } catch {
      setSaid("Couldn't reach the clipboard here. Download the CSV instead.");
    }
  };
  const csv = () => {
    download(`${stem}.csv`, "text/csv;charset=utf-8", `﻿${toCsv(trackerRows(ids, today))}`); // BOM so Excel reads UTF-8
    setSaid(`Downloaded ${ids.length} rows as CSV.`);
  };
  const ics = () => {
    download(`${stem}.ics`, "text/calendar;charset=utf-8", myListFeed(calIds));
    setSaid(`Downloaded a calendar file for ${calIds.length} ${calIds.length === 1 ? "company" : "companies"}. It's a one-time import: download again for updates, or subscribe to the full feed.`);
  };

  return (
    <div className="mylist">
      <p className="mylist-n">
        {starred.size
          ? `${starred.size} starred. Exports cover these: status today, usual timing, deadlines, posting links.`
          : `Nothing starred yet. Star companies in their field notes or the timing chart to build a list; until then, exports cover all ${companies.length}.`}{" "}
        <span className="muted">Your list stays in this browser; there&apos;s no account.</span>
      </p>
      <div className="mylist-row">
        <MyListToggle />
        <button className="chip" onClick={copy}>Copy to my tracker</button>
        <button className="chip" onClick={csv}>Download CSV</button>
        {starred.size > 0 && calIds.length > 0 && <button className="chip" onClick={ics}>My list as .ics</button>}
      </div>
      <p className="mylist-cal">
        Calendar for all companies: <a href={webcalUrl(calPath("all"))}>subscribe</a> or <a href={calPath("all")} download>download .ics</a>.{" "}
        <span className="muted">Deadlines, estimated openings (marked as estimates), and GSB dates.</span>
      </p>
      <p className="mylist-said" aria-live="polite">{said}</p>
    </div>
  );
}

/** One quiet control in the contents bar that holds the list filter and every export, found wherever the reader is. */
export function MyListMenu() {
  const n = useStarred().size;
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // Close on Escape or a tap outside, like any menu.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !ref.current?.open) return;
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, []);
  return (
    <details ref={ref} className="mylist-menu">
      <summary>my list{n ? ` (${n})` : ""} · export</summary>
      <div className="mylist-pop"><MyListTools /></div>
    </details>
  );
}

/** Per-company calendar links for the field notes panel. */
export function CompanyCalLinks({ company: c }: { company: Company }) {
  if (!hiring[c.id].hasProgram) return null;
  return (
    <p className="small mylist-cal">
      {c.name} in your calendar: <a href={webcalUrl(calPath(c.id))}>subscribe</a> or <a href={calPath(c.id)} download>download .ics</a>
    </p>
  );
}
