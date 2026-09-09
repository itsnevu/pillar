"use client";

import { useState } from "react";

const NAV = [
  { href: "/borrow", label: "Borrow", active: true },
  { href: "/earn", label: "Earn", active: false },
  { href: "/portfolio", label: "Portfolio", active: false },
];

/** Primary nav + the mobile toggle (Turret's `dockyard-header-navigation`). Only the toggle needs state. */
export function HeaderNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <div className="dockyard-header-navigation">
      <button
        aria-controls="nav"
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        className="dockyard-nav-toggle"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      </button>
      <nav aria-label="Primary" className="rusd-nav" data-open={open ? "true" : "false"} id="nav">
        {NAV.map((item) => (
          <a
            key={item.href}
            className="rusd-nav-link"
            href={item.href}
            data-active={item.active ? "true" : "false"}
            aria-current={item.active ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
