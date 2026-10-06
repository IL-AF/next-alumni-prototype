# NEXT Alumni Platform: clickable prototype (v2, NEXT theme)

Fictional people and events. Program names are NEXT's real programs; cohort years are made up.
Built to show navigation, directory search and board threads. Not production code.

## Run it

Double-click `index.html`, or for a real localhost run this in Terminal from this folder:

    python3 -m http.server 8000

then open http://localhost:8000. The Montserrat font loads from Google Fonts, so you need to be online for the exact look.

## What changed from v1

- Theme follows nextcanada.com: black header, Montserrat, uppercase headings, red accent, halftone dots, pill buttons.
- Top navigation instead of a sidebar (bottom tab bar on phones).
- Board: sleek upvote pill, unlimited nested replies with collapse lines and "Continue this thread",
  upvotes on replies, @mentions with autocomplete (type @ in any reply box), Top/New sort for replies.
- Directory: filters are dropdown chips instead of a long checkbox column; card grid; Country filter;
  two US-based alumni added (New York, Boston) plus the existing San Francisco one.
- Events: month calendar is the default view, with an agenda beside it. Click a day to filter.
  "Hosted by NEXT" vs "Community event" replaces "Official".
- Profiles: Expertise and Sectors are separate sections. "Legal" skill and "Legal tech" sector added.
  Location now has city, province/state and country.

## Latest tweaks

- Board posts can have several topics (e.g. Fundraising + Events). The topic filter is multi-select too.
- Light / dark mode: the sun/moon button in the header, or Appearance in the avatar menu (System, Light, Dark).
- Directory cards show every "Open to" option, and a LinkedIn icon next to each name that turns LinkedIn blue on hover
  and opens the profile in a new tab (the fake "-example" profiles don't exist on LinkedIn).
- Calendar: "today" is a dark circle so it isn't confused with red "Hosted by NEXT" events; event titles wrap instead of being cut off.

## Directory search in production

The prototype filters an in-memory array. The real build would run the same logic as SQL in Postgres, roughly:

    SELECT p.*
    FROM profiles p
    WHERE p.search_vector @@ websearch_to_tsquery('simple', unaccent($1))   -- keyword search
      AND ($2::text[] IS NULL OR p.country = ANY($2))                        -- Country filter
      AND ($3::text[] IS NULL OR p.skills && $3)                             -- Expertise filter (any of)
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('simple', unaccent($1))) DESC
    LIMIT 24 OFFSET $4;                                                        -- paged results

## Still left out

AI search, real sign-in, database, emails, jobs and perks (December), direct messages (later version).
Everything is in memory; a reload resets posts, votes, RSVPs and edits.

## Files

- `index.html`: page and styles (theme tokens at the top)
- `data.js`: fake people, posts (with nested replies) and events
- `app.js`: all behaviour, split into DIRECTORY, BOARD, EVENTS and ADMIN sections
