# Events on the homepage

The homepage shows an **Upcoming Events** section (the last section, above the footer) built from the WordPress **Events** post type, and every event has its own page at `/event/<slug>`.

## How the section behaves

| Current events | What visitors see |
|---|---|
| None, or all expired | No section at all |
| One | Two columns: the event's picture, and its title, date/time/location, short description and an **Event Details** button |
| Two or more | The **newest** event's picture as the advertisement (with its title and date under it), and a list of the **other** current events, soonest first |

- Every picture, title and list item links to the event's page, which shows the full flyer (uncropped), date, time, location and full description. Past events stay reachable by link and say "This event has already taken place".
- "Newest" = most recently **published** in WordPress.
- An event **expires** after its last day (End Date if set, otherwise Event Date), in the visitor's local time.
- Events are always loaded live from WordPress when the page opens (never baked into the build), so new, edited or expired events show without rebuilding the site.

## Event fields in WordPress (one-time setup, needed for dates)

Out of the box an event only has a title, description and featured image, so the site can't tell when an event happens or when it has expired. **Until the fields below exist, every event is treated as current and never expires** — delete or unpublish old events by hand.

Create this once in **production** (and in **staging** if you test there) with ACF:

1. **ACF → Field Groups → Add New**, title **Event Details**.
2. Add the fields (Field Name / Type / GraphQL Field Name):

   | Label | Field Name | Type | GraphQL Field Name | Required |
   |---|---|---|---|---|
   | Event Date | `event_date` | Date Picker | `eventDate` | Yes |
   | End Date | `event_end_date` | Date Picker | `eventEndDate` | No (multi-day events) |
   | Start Time | `start_time` | Time Picker (or Text) | `startTime` | No |
   | Location | `location` | Text | `location` | No |

3. **Settings → Location Rules:** Post Type **is equal to** **Events**.
4. **GraphQL tab:** **Show in GraphQL = On**, **GraphQL Field Name = `eventDetails`**.
5. **Save**, then edit each event, fill in the date (and the rest), and **Update**.

The site picks the fields up automatically (it falls back to title/description/image only while the group is missing). Date Picker return format doesn't matter: `20261121`, `2026-11-21`, `11/21/2026` and ISO dates are all understood.

## Tips for the advertisement picture

- Set the event's **Featured Image**; it's shown at full width, uncropped.
- Wide images (about 2.5:1, e.g. 1500×600) look best in the homepage column; tall flyers work too but take more space.
- Add **Alt Text** to the image in the Media Library for screen readers.
