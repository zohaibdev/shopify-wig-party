# Wig Party — Shopify Theme Development Context

> Permanent development context and handoff document.
> Keep this updated as implementation decisions are made. Do not leave important
> decisions only in chat.

---

## 1. Project Overview

**Wig Party** is a Shopify storefront built on the **Dawn** boilerplate.
The homepage is sliced from Figma into discrete, merchant-configurable Shopify sections.

- **Store:** `wigpartyshop.myshopify.com` (the old `aria-co-bxpzki8j` store is decommissioned)
- **Local dev:** `shopify theme dev` → `http://127.0.0.1:9292/`
- **Theme root:** `C:\Users\Zohaib\Documents\Edits\Wig Party`

### Naming history (important)
The project was originally sliced from a Figma file branded **"Aria & Co."**
(`WG Dev Trial`). It has since been **rebranded to Wig Party**, and the theme folder was
renamed `aria` → `Wig Party`. The internal CSS/JS namespace is still `aria-*`
(`.aria-header__…`, `aria-best-sellers.js`, `section-aria-*.css`).

**Decision:** the `aria-*` namespace is retained. It is a stable, unique, well-scoped
prefix; renaming it across every section, stylesheet, and script would be a large
high-risk refactor with zero user-facing benefit. Treat `aria-` as "this theme's custom
namespace", not as a brand reference.

---

## 2. Figma Design Source

| | |
|---|---|
| **Active file** | `hYm4qeyMR2LRpeVQQlkApG` — *Wig Party - Dev* (confirmed working) |
| **Also valid** | `ENaVLHelxoSTgyvO65mVBw` — same design, node IDs offset by +1 |
| **Page / section** | `V4 - For Developer Slicing` → frame `Home V1` (`1:283`), 1440×14252 |
| **Superseded file** | `trmgKWFenu1AjwKldlbr9G` — *WG Dev Trial* (Aria & Co. branding) |
| **Client file** | `GwwzFncuGYte0VMIN8G9UV` — *01. Wig Party \| WEBSITE (Client)*. Same V4 design, third set of node IDs: section `6272:778` -> frame `Home V1` `6272:779`. Footer is `6272:1528`. |

> **Node-ID caution:** the two live files hold the same design but their IDs differ by one.
> In `hYm4qeyMR2LRpeVQQlkApG` the section *wrappers* are `1:794`, `1:852`, `1:880`, `1:917`,
> `1:942`, `1:975`, `1:1001`, `1:1033`; the frame-map table below lists the *inner* frames
> (each +1), which is what `ENaVLHelxoSTgyvO65mVBw` uses. Either resolves — just don't mix
> a node ID from one file with the other's key.

> **Access / quota notes.** Two distinct failures have occurred, with different fixes:
> 1. *"You don't have edit access"* — a Figma **seat** problem, not file sharing. The MCP
>    needs a Full/editor seat. Run `whoami` on the Figma MCP and check the owning team.
> 2. *"Reached the Figma MCP tool call limit on the Starter plan"* — a hard per-plan quota
>    on tool calls. It resets with time. Budget calls: pull each frame **once**, and use
>    `get_metadata` (cheap, structure only) to locate frames before spending a
>    `get_design_context` call on them.
>
> The connector can also drop mid-session with *"connection to this connector was
> invalidated"* — that requires the user to reconnect it from their connector settings and
> cannot be repaired from inside a non-interactive session.

### V4 frame → section map

| Figma node | Frame content | Theme section | Status |
|---|---|---|---|
| `1:285` | Header + Hero ("Live with Kristi") | `header.liquid`, `hero.liquid` | Built (pre-V4) |
| `1:404` | Shop By Collection | `shop-by-collection.liquid` | Built (pre-V4) |
| `1:448` | Best Sellers — **light** | `best-sellers.liquid` | **Built (V4 restyle)** |
| `1:493` | Start Here | `start-here.liquid` | **Built** |
| `1:587` | Meet the Icons — the sibling "Background" frame under `1:493`, **not** `1:588` (which is only a 48px play-input container). Both sit inside wrapper `1:492`. | `meet-the-icons.liquid` | **Built** |
| `1:602` | Community Exclusive / Flash Discount | `community-exclusive.liquid` | **Built** |
| `1:636` | Deals & Exclusives | `deals-exclusives.liquid` | **Built** |
| `1:674` | New and trending | `new-trending.liquid` | **Built** |
| `1:683` | Real Customers, Real Confidence | `real-customers.liquid` | **Built (Swiper)** |
| `1:776` | Education and guides | `education-guides.liquid` | **Built (plain links + image rotation)** |
| `1:795` | Find Your Perfect Wig | `find-your-wig.liquid` | **Built** |
| `1:853` | Real Women. Real Wigs. Real Confidence. | `community-photos.liquid` | **Built** |
| `1:881` | Why Wig Party | `why-wig-party.liquid` | **Built** |
| `1:917` | Join the Party (newsletter) | `join-the-party.liquid` | **Built** |
| `1:942` | About Wig Party ("Hi, I'm" + Kristi signature) | `about-wig-party.liquid` | **Built** |
| `1:975` | @WigParty on Instagram | `instagram-feed.liquid` | **Built** |
| `1:1001` | Trust badges (Free Shipping / 30-Day / Returns / Pay in 4) | `trust-badges.liquid` | **Built** |
| `1:1033` | Footer | `aria-footer.liquid` | **Built** — swapped in via `footer-group.json`. Dawn's `footer.liquid` is left on disk as a revert path. |

---

## 3. Shopify Theme Architecture

Standard Dawn structure. Custom work lives alongside Dawn's stock files:

```
sections/    header.liquid, hero.liquid, shop-by-collection.liquid,
             best-sellers.liquid  ← custom (V4)
             + Dawn stock sections
snippets/    aria-product-card.liquid, aria-icon.liquid,
             aria-cart-icon-bubble-content.liquid  ← custom
assets/      section-aria-*.css, aria-*.js, vendor-swiper-bundle.min.*  ← custom
config/      settings_schema.json, settings_data.json
locales/     en.default.json, en.default.schema.json
templates/   index.json  ← homepage section composition
```

### Custom sections already built

| Section | Purpose | Notes |
|---|---|---|
| `header.liquid` | Announcement bar + custom navigation | Replaces Dawn's header entirely. Announcement messages are repeatable blocks. Nav is driven by a Shopify `link_list`. |
| `hero.liquid` | Homepage hero | **739px** desktop height, **full-bleed 1440-wide media, no overlay/scrim**, copy panel left-anchored at 80px in a 607px column, floating "Live with" card pinned 40px from the media's bottom-right. |
| `shop-by-collection.liquid` | Collection grid | Real `collection` objects via blocks, CSS hover scale. |
| `best-sellers.liquid` | Product carousel | Swiper, dynamic progress bar, real product blocks. |
| `why-wig-party.liquid` | Video frame + trust row | Matted media frame, click-to-play `<deferred-media>`, signature overlay, 3 feature blocks. |
| `join-the-party.liquid` | Newsletter | Full-bleed photo + diagonal scrim, frosted panel, real `{% form 'customer' %}`, 4-photo decorative collage. |
| `about-wig-party.liquid` | Founder story | Eyebrow chip, 56px heading, CTA, Dawn `social-icons` row, dark signature, 680×625 photo. |
| `instagram-feed.liquid` | Shoppable UGC carousel | Swiper (shared script), product-tagged cards with title/price/quick-add, progress bar + prev/next. |
| `trust-badges.liquid` | Trust row | 4 blocks, 64px icons, 255px columns at 70px gaps. No JS. |
| `aria-footer.liquid` | Site footer | Menu-driven columns, real newsletter form, social blocks, dynamic payment icons, gradient wordmark. Replaces Dawn's footer via `footer-group.json`. |

---

## 4. V4 Design System

### 4.1 Design tokens — `assets/style.css`

`assets/style.css` is the **single source of truth** for design tokens. Read it before
adding any CSS. Do not duplicate values that already exist here.

```css
--py: #A64A4C;   /* primary — brand terracotta */
--sy: #000000;   /* secondary — black */
--it: #CD8080;   /* tertiary tint */
--qi: #BC696B;   /* quaternary — muted rose (borders, progress bar) */
--py-rgb / --sy-rgb / --it-rgb / --qi-rgb   /* rgb triplets for alpha use */

--black: #000;  --white: #fff;
--input-border: #E2E2E2;
--input-placeholder: rgba(255,255,255,0.55);

--heading-h1-size: 86px;   --heading-h1-weight: 600;
--heading-h2-size: 56px;   --heading-h2-weight: 500;  --heading-h2-line-height: 64px;
--heading-h3-size: 24px;   --heading-h3-weight: 400;
--subtitle-size: 14px;
--title-content-size: 20px; --title-content-line-height: 28px;
--body-size: 14px;

--border-radius: 4px;
--section-spacing: 80px;   /* vertical section padding */
--title-bar-spacing: 40px;
--row-gap: 40px;
--col-gap: 15px;
--container: 1360px;
```

### 4.2 Extended colors observed in V4

Colors present in the V4 Figma but **not** yet tokens. Added as literals in
section-scoped CSS; promote to `style.css` if reused across 3+ sections.

| Hex | Role |
|---|---|
| `#FAF8F5` | Light surface — rating-badge pill fill |
| `#F5EBE2` | Warm sand — bottom of the Best Sellers background gradient |
| `#2B2C2B` | Body text on light surfaces |
| `#3F3E3E` | Product card title |
| `#FA5656` | "Sold out" badge |
| `#FBB2B2` | "Best seller" badge |
| `#F79510` | "New arrival" badge |
| `#A9AAB5` | Carousel prev-button border |

### 4.3 Typography

- **Family:** **Montserrat Medium for headings** (`type_header_font = montserrat_n5`),
  **Poppins Regular for body** (`type_body_font = poppins_n4`) — both set via Shopify
  theme settings, matching V4's published text styles. **Never** hardcode `font-family`
  in section CSS; it must stay merchant-controlled.
  Figma text styles: Heading/H1 56/64 · Heading/H2 48/56 · Body/Small 16/26 ·
  Body/Medium 18/28 · Body/XS Medium ALL-CAP 14/22.
- **Section heading (h2):** 56px / 64px line-height / weight 500 → tokens above.
  Steps down to 44px at ≥750px and 32px on mobile.
- **Section subheading:** 20px / 28px line-height.
- **Product title:** **18px / 28px, black** (measured from V4 node `1:473`; the earlier
  "20px / 22px `#3F3E3E`" in this doc was wrong and has been corrected in the CSS).
- **Body:** 14px base; 18px for hero/large descriptive copy.

### 4.4 Layout & container

- **Max content width: `1360px`** (`--container`), centred, **no inner horizontal
  padding** at desktop. Set globally via Shopify's `page_width` setting (1360).
- Section chrome (background bands, gradients) bleeds **full viewport width**; only the
  *content* is capped at 1360px.
- Desktop gutter: `40px` (1440 − 1360 = 80 ÷ 2). Mobile gutter: `16px`.
- **Section vertical padding:** `80px` (`--section-spacing`) desktop,
  `64px` at ≥750px, `48px` mobile.

**Container padding rule (important, applies to every section).**
At ≥990px the *section* supplies the 40px gutter and the *inner* wrapper drops to
`padding-inline: 0`:

```css
@media screen and (min-width: 990px) {
  .aria-<section>        { padding-inline: 40px; }
  .aria-<section>__inner { max-width: var(--container); padding-inline: 0; }
}
```

Putting `max-width: 1360px` *and* `padding-inline: 40px` on the same element yields only
1280px of content and silently shrinks every grid/slide (New & Trending slides came out
246px instead of 262px). Below 990px the inner keeps its own 16px/40px padding.

### 4.5 Responsive breakpoints

Reuse **Dawn's existing breakpoints** — do not invent a new scale.

| Width | Meaning |
|---|---|
| `< 750px` | Mobile |
| `≥ 750px` | Tablet |
| `≥ 990px` | Desktop (section content) |
| `≥ 1280px` | **Header only** — full inline navigation |

> **Header exception (1280px).** The full inline desktop nav needs ~1325px:
> logo 130 + menu 727 + inline search 248 + two 44px icon buttons + gutters.
> Below that, `.aria-header__menu` (nowrap) overflows its shrinking flex parent and
> visually collides with the search field — this was a real defect at 1024px.
> The header therefore keeps the hamburger + search-toggle pattern up to 1279px and only
> goes inline at 1280px+. Section content still switches at 990px as normal.

Supported range **320px → 1440px**. No horizontal overflow at any width.
Minimum tap target **44px**.

### 4.6 Buttons

Base classes live in `style.css` (`.th-btn`, `--secondary`, `--borderd`).

**V4 outline button** (Best Sellers "View Product"):
`1px solid #000` · `radius 2px` · `padding 12px 24px` · `18px/28px` · weight 400 · black text.
Hover → fill `--py`, white text.

### 4.6b Live pulse — `.aria-live-pulse` (shared)

Broadcast indicator on the header's "Live" nav dot and the hero Watch Live badge dot.
Declared **once** in `style.css` (globally loaded at `theme.liquid:354`) rather than in
either section stylesheet — both sections load on the homepage, so a per-section copy
would put the same keyframes in the cascade twice.

Add the class to the dot and set two custom properties on it:

| Property | Purpose |
|---|---|
| `--aria-pulse-color` | Ring colour. Defaults to `currentColor`, which is wrong for these dots — both take their colour from `background`, not `color`, so **always set it explicitly**. |
| `--aria-pulse-scale` | How far the ring travels. Header `3.2` (6px dot), hero `2.2` (11px dot). |

Two layers: the dot core breathes (opacity 1→0.65, scale 1→0.88) and an `::after` ring
expands and fades (opacity 0.55→0). 2s, `infinite`. The ring is fully faded by 70% so
there is a beat of stillness between pulses — a continuous ripple reads as a loading
spinner. Only `transform`/`opacity` animate, so it stays on the compositor.

Notes worth keeping:
- **Smaller dots need a bigger scale.** At 6px a 2.2× ring is only 13px and barely reads;
  the header runs 3.2×. Match the ring's *absolute* travel, not the multiplier.
- **`pointer-events: none` on the dot is load-bearing.** Both dots sit inside links; without
  it the ring would be a click target over the link. Verified that a click on either dot
  falls through to its parent `<a>`.
- **The ring must clear neighbouring text.** It grows from the dot's *centre*, so it extends
  `(size × scale − size) / 2` past each edge — 6.6px for both dots here, against an 8px
  flex gap to the label. That 1.4px clearance is why the hero is held to 2.2×.
- Sizing/clip clearance measured: header 24px (tightest, top), hero 71px. Nothing clips,
  even though `.aria-hero` and `.aria-hero__media` are both `overflow: hidden`.
- Gated on `prefers-reduced-motion: no-preference` (opt-in), matching the announcement
  cycle. Purely decorative, so no reduced-motion fallback is needed — the header already
  carries a `visually-hidden` "live now" string for assistive tech.

> **Verifying animations in the Browser pane:** a hidden pane **stops the document
> timeline**, so `getAnimations()` reports `playState: "running"` while every computed
> value stays pinned to the 0% keyframe — it looks exactly like a broken animation. Check
> `document.hidden` first. To verify regardless, seek manually (`anim.currentTime = t`,
> flush with `void el.offsetWidth`, read computed style) which forces a style recalc; that
> is how the interpolation above was confirmed. Same class of artifact as the 0-width-pane
> overflow false positive in §11.

### 4.6c Sticky header

`.shopify-section-group-header-group` is `position: sticky`. Two deliberate choices:

**Sticky is on the GROUP, not on `.aria-header__nav-band`.** A sticky element is contained
by its parent, and the nav band's parent (`.aria-header`) is only as tall as the header
itself — it would have nothing to travel down and would appear not to stick at all. The
group's parent is `<body>`, so it can pin for the whole page. Verified there is no
`overflow` / `transform` / `filter` ancestor to trap it.

**The announcement band scrolls away; only the nav band pins.** Keeping all 110px pinned
would eat an eighth of a phone viewport permanently. This needs no JS — the group pins at
a *negative* offset equal to the band's height, so it stops moving exactly when the nav
band's top edge reaches y=0:

```css
.shopify-section-group-header-group { --aria-announcement-height: 42px; position: sticky; top: 0; }
.shopify-section-group-header-group:has(.aria-header__announcement) {
  top: calc(-1 * var(--aria-announcement-height));
}
```

The 42px is safe to hardcode: 10px vertical padding either side of a **fixed 22px** track
whose items are `position: absolute` + `white-space: nowrap`, so it cannot reflow, and only
`padding-inline` changes at breakpoints. Measured 42px at 375, 768 and 1440. The `:has()`
guard matters — a store with no announcement blocks *and* no store badges does not render
the band at all, and without the guard it would hide 42px of nav; verified the nav still
pins flush at 0 in that case.

`html { scroll-padding-top: 72px }` is a required companion, not decoration: in-page anchor
targets (the "Skip to content" link jumping to `#MainContent` included) would otherwise land
underneath the pinned band. 72px is the band's tallest (768px width; 68px at 375 and 1440).

**Do not raise the group's z-index above 4** to make this work — it does not need it, and
the ceiling is real (see §5 gotcha 6). Verified by hit-testing `elementFromPoint` over the
pinned band at 18 scroll positions spanning every section: the header is on top at all of
them. That only holds because `.aria-hero__inner` was dropped from `z-index: 10` to `1`
— at 10 the hero would swallow the pinned header exactly as it swallowed the search
dropdown.

Also verified while pinned: the search dropdown travels with the header and stays in the
viewport with all rows clickable; the mobile drawer and search panel are `position: fixed;
inset: 0`, so they are viewport-anchored and unaffected; the cart drawer (z-index 1000)
still covers it. No horizontal overflow at any width.

### 4.6d The 990-1279px band (the "1024 is cramped" fix)

**Root cause, one sentence:** several sections hold V4's *absolute pixel* media width
(`flex: 0 0 680px`, `0 1 630px`) which fits V4's 1328px content row, but at a 1024 viewport
the row is only **929px** (1009 client width minus the 40px padding either side), so the
fixed column took nearly all of it and starved its text sibling.

Measured at 1024 before the fix:

| Element | Before | After |
|---|---|---|
| `.aria-ugc__side` | **229px**, heading 7 lines, carousel track 229px vs its own 320px slides | 455px, 3 lines, track 455px |
| `.aria-about__copy` | **229px** | 455px (clears the 345px signature) |
| `.aria-community-exclusive__panel` | **275px**, card 990px tall | 493px, card 584px |
| `.aria-start-here__card` | **145px** - a 113px content box holding a **120px icon** | 240px (208px box) |
| New & Trending slide | **176px**, price overflowed | 223px, no overflow |
| Best Sellers slide | 223px (design 331) | 302px |
| Instagram slide | 264px | 368px |
| `.aria-trust__list` column | 180px (70px gutter ate 210px) | 211px |

**The band is `@media screen and (min-width: 990px) and (max-width: 1279px)`, and it is a
range, not a point.** The cramping is not specific to 1024 - a fixed 680px column plus a
readable text column needs ~1250px of viewport, so everything from 990 to ~1250 is starved
by the same arithmetic. A narrow window (e.g. 1000-1040px) would have fixed 1024 and left
1041-1279 exactly as broken, with a visible snap at 1041. 990 and 1280 are the theme's own
existing breakpoints, so nothing leaks: 1280/1440 keep the untouched desktop rules and
768/375/390 keep the untouched tablet/mobile ones (verified `BAND_MATCHES === false` and
every original computed value intact at all five).

The fix is **proportional, not a blanket reduction**: the fixed columns become `flex: 1 1 0`
so they share the row, which restores V4's *ratio* (at 1440 it is 645/680 for About and
630/674 for Community Exclusive - i.e. roughly half each, and the Community Exclusive panel
is meant to be the wider half) rather than its pixel value, which is the part that does not
survive a narrower viewport.

Each fix lives in its own section stylesheet under an identical banner comment, not in a
new global file - a global sheet would have to be loaded on every page.

> **Known, accepted discontinuity at 1279 -> 1280.** Because 1280 had to stay byte-identical,
> the band's proportional values do not converge on the desktop rules: About media steps
> 582 -> 680, Best Sellers slides 387 -> 287, Start Here 3 columns -> 6. The Start Here jump was
> originally a 387 -> 188px cliff; capping the band's track at `minmax(0, 240px)` with
> `justify-content: center` (the same idiom the trust badges use) holds the card near V4's
> 214px across the whole band and shrinks that step to 240 -> 188. Discrete column counts
> always put a jump *somewhere* in 990-1280; it is only visible while slowly dragging a
> window across that exact pixel.

**Carousels:** `aria-product-carousel.js` gained a `1280` breakpoint. `data-slides-desktop`
is now the design count **from 1280 up**, and the new optional `data-slides-lg` covers
990-1279 only, defaulting to `data-slides-desktop` - so any carousel that does not set it
behaves exactly as before at every width. Set on Best Sellers (3), New & Trending (4) and
Instagram (2.6). **Do not fold those two breakpoints back into one.**

**The footer was the same bug, found later.** At ≥990 the row wants **1132px**: three
203px link columns with two 80px gutters (769) + the 40px gap + the 323px newsletter
column. Both halves had shrink disabled (`flex: 0 0 203px` / `0 0 323px`), so at a 1024
viewport the newsletter column ran to x=1132 — **123px past the 1009px edge** — and because
`.aria-footer` is `overflow: hidden` it was silently **clipped instead of producing page
scroll**, which is why it looked cut off with no scrollbar to explain it. Exactly the Join
the Party failure mode; when a section is `overflow: hidden`, `pageOverflowX === 0` proves
nothing. **Compare `scrollWidth` against `clientWidth` on the section itself.**
Fixed in the band by paying the deficit out of the 80px inter-column gutter (→ 32px, which
keeps the link columns at V4's exact 203px) and letting the newsletter column shrink for the
last ~27px (323 → 296). `width: auto` is required alongside the flex change because the base
rule also sets a hard `width: 323px`. Verified 0 offenders and `scrollWidth === clientWidth`
at both 1024 and 990 (the band's tightest point, where the column lands at 262px and the
input and Subscribe button still fit).

**Deliberately left alone** (measured, nothing broken - avoid unnecessary design change):
Shop By Collection's 4x220px cards (titles still one line) and the Education & Guides
full-bleed `742fr 698fr` grid (proportional, so it scales cleanly on its own).

### 4.6e Desktop mega menu

`snippets/aria-mega-menu.liquid` + `snippets/aria-mega-column.liquid` +
`snippets/aria-mega-signature.liquid` + `assets/component-aria-mega-menu.css` +
`assets/aria-mega-menu.js`, driven by a `mega_menu` block on `sections/header.liquid`.

> ## ⚠️ THE APPROVED FRAMES ARE `6337:*`, NOT `6316:*` (2026-09-07)
>
> The client approved a **newer set of navigation frames** on page **`6337:3110`**
> ("↳ ⚪️ Navigation - For Developer") of client file `GwwzFncuGYte0VMIN8G9UV`:
>
> | panel | approved frame | superseded V4 frame |
> |---|---|---|
> | Shop | `6337:4768` | `6316:3859` |
> | Best Sellers | `6337:3148` | `6316:2349` |
> | Start Here | `6337:3448` | `6316:2499` |
> | Live | `6337:3786` | `6316:3069` |
> | Community | `6337:4126` | `6316:3447` |
> | Dailey Deals | `6337:4462` | `6316:3706` |
>
> This component was originally built from the V4 frames and several of the differences
> between the two sets are **real design changes**, not drafting noise. Everything below
> reflects the `6337` frames. Do not "restore" a V4 behaviour from the older notes:
>
> 1. **The open parent KEEPS its chevron.** V4 read as hiding it; the approved frames draw
>    it inside the open pink pill on every panel that has one.
> 2. ~~**Only Shop / Best Sellers / Start Here have a chevron at all.**~~ **SUPERSEDED
>    2026-09-08 by client request — every parent that owns a panel now shows one.** The
>    frames did give a chevron to only those three (Live showed its red dot; Community and
>    Dailey Deals showed nothing, open or closed), and `mega_caret_list` tracked it. The
>    client has since asked for the affordance to be uniform, so that list is gone and the
>    nav loop tests `has_mega`. See "Uniform parent chevron" in 4.6g below.
> 3. **The Best Sellers product row sits on bare white.** The white→cream gradient shell
>    belongs to three columns only — Start Here products, Deals products, Community CTA —
>    and is applied by the `col_shell` argument, not by column type.
> 4. **The Community CTA card has NO photo.** Its shell is the gradient and nothing else.
> 5. **The Dailey Deals card is sharp.** Its 20px outer radius is on an *unfilled* frame,
>    so nothing of it is drawn; only the photo and glass panel are rounded, at 4px.
> 6. **Products columns are sized by their OUTER width** (shell padding included): Best
>    Sellers 1076, Start Here / Deals 814. Feeding the inner width shrank every card.
> 7. **The panel inset is 20px, not the header's 40px** — see the trade-off note below.
> 8. **Column glyphs are the frames' own exported SVGs** — see the icon table below.

**One DEDICATED BLOCK TYPE per parent** — `shop_mega_menu`, `best_sellers_mega_menu`,
`start_here_mega_menu`, `live_mega_menu`, `community_mega_menu`, `daily_deals_mega_menu`.
The parent label is derived from the block TYPE in `header.liquid` (a `case` building two
parallel `mega_name_list` / `mega_id_list` arrays), so it is a structural fact rather than
something the merchant types.

Refactored away from an earlier single generic `mega_menu` block that carried **84**
settings (five `col1_*`…`col5_*` slots). Now everything the Figma frames already decide —
menu handles, column order and types, V4 widths and card heights, icons, the column gap,
which column starts the right-hand group — is a literal argument inside
`snippets/aria-mega-menu.liquid`, and the Theme Editor exposes only images, copy, CTA links
and a product source: **4–15 settings per block**. `snippets/aria-mega-column.liquid` holds
the one copy of all eight column renderers, so a panel is just a short list of
`render 'aria-mega-column'` calls. Adding a seventh parent = one block type + one `when`.
The ticker copy is a single SECTION setting (`mega_ticker_text`), not six block settings. `enabled: false` removes the panel *and* the
trigger, and the parent falls back to a normal header link.

**Five column slots per block**, read through computed setting keys
(`block.settings['col' | append: i | append: '_type']`) so the snippet is one loop, not five
duplicated branches. Eight column types cover every distinct shape in the six frames:
`menu_divided`, `menu_padded`, `style_cards`, `promo_card`, `products`, `feature_card`,
`media_card`, `photo_row`.

**Audit pass (2026-09-02) — what the first build got WRONG.** Worth reading before touching
this component, because most of it was invented rather than measured:
- **The 58px menu rows are OUTLINED CARDS**, not padded text: `1px solid #EADDD4` at radius
  12. The first pass used radius 2, no border and a pink hover wash.
  **The row is 58px, and the padding is `15px 11px` — not `16px 12px`.** Figma strokes sit
  *inside* the frame, so the border is part of those numbers: 15 + 26 + 15 + 2 = 58, with
  the label 11 + 1 = 12px in. A flat 16/12 made every row 60px.
- **Column icons are `#A64A4C`**, not black (except `gold-sell`, `#BC696B`). The label
  beside them is black (except the Live column's, `#A64A4C`). See the glyph table above.
- **The product title is gradient-clipped text** — white → `#EADDD4`, Poppins **Medium**
  16/26 **uppercase**. The gradient IS the design's legibility device; the first pass added
  a dark scrim instead, which V4 does not draw. Scrim removed.
- **The product badge is a RANK** (`#1`, `#2`…) in amber, driven by loop position — not a
  "Sale" flag.
- **The product footer is an outlined glass pill**: `1px solid #000`, radius 8,
  `backdrop-filter: blur(6.7px)`, padding `2px 4px 2px 2px`. It was a bare row.
- **The cart tile carries the product shot** behind the glyph, 1px white border. The image is
  passed in as a custom property on the footer because the button itself comes from the
  shared quick-add snippet and custom properties inherit into it.
- **Price is Poppins Medium 18/28**, not regular.
- **Feature cards are TWO nested boxes**: a radius-8 shell (white→cream gradient, or a photo
  for Best Sellers/Deals) holding a glass card — `rgba(255,255,255,0.13)`,
  `backdrop-filter: blur(50px)`, 1px white border, radius 4, 21px padding — with
  Montserrat Medium 24/32 over Poppins 20/28 in `#1F1C1C` and a black UPPERCASE CTA. The
  first pass built a photo with a dark scrim and white text.
- **Photo-row images sit in cream MATS** (`#EADDD4` box, image inset 6px), like polaroids.
- **`.aria-mega__btn` is BLACK**, not Primary/Dark Pink — the terracotta belongs to the
  promo card's CTA only. The outline variant is sentence case ("See the gallery →").
- **New tokens** added to `style.css`: `--cream: #EADDD4` (Primary/Cream), `--ink: #1F1C1C`.

**Column headings come from the MENU, not the block.** Every provided handle is named after
its column heading (`header-shop-shop-by-collection` → "Shop by Collection",
`header-community-our-heart` → "Our Heart"), so `linklists[handle].title` wins and the
block's heading setting is only a fallback for a menu-less column or a missing menu.
Verified: pointing a column at `main-menu` rendered "Main menu" over the fallback.

**Child menus are honoured, not flattened.** `snippets/aria-mega-sublinks.liquid` renders
`link.links` as an indented list (14/22 in Primary/Gray behind a 1px cream rule). In the
outlined-card rows the `<li>` takes over the card border and the parent anchor drops its own
so they do not double up. V4 mocks every column flat, so it prescribes no nested treatment —
these rules stay inside the design's vocabulary. Verified against `main-menu`, which has two
items with children: 4 nested lists / 14 children rendered, no double borders.

**Audit pass 2 (2026-09-02) — icons, ticker, bridge.**
- **The bottom strip is ONE ticker, not three CTA cards.** V4 node 6316:3979 is a single
  centred line — "JOIN US LIVE ON FACEBOOK · 1,100+ BELLE TRESS WIGS IN STOCK · SHOP BY
  STYLE" — on a **`#A64A4C`** ground with **white 16/24 capitalize** text and 10px padding,
  no border. An earlier pass built it white with grey 14/24 uppercase. The separators carry
  DOUBLE spaces, hence `white-space: pre`. If asked again for "three CTA cards with wrong
  backgrounds", this is the element: one strip, one background.
  FONT: V4 sets it in Josefin Sans, which the theme does not load (only the two Shopify
  font-picker families are). It inherits the body font; size/weight/colour/case all match.
- **Both flagged icons use the frames' OWN exported SVG paths**, added to `aria-icon.liquid`
  as `mega-chevron` (from `arrow-up-01`, 14x14) and `mega-cart-02` (`shopping-cart-02`,
  node 6337:3230, 20x20). They are 1px-stroke line icons on round caps — the theme's stock
  `chevron-down` (1.8px, 28-box) and `cart` are visibly heavier, which is what read as
  "wrong icon". The chevron's 180° rotation is baked into the SVG so it needs no CSS
  transform. `aria-product-card-quick-add.liquid` gained an optional `icon` param (defaults
  to `cart`) so the mega menu can pass its own glyph without forking the snippet.

**ALL SEVEN COLUMN GLYPHS ARE THE FRAMES' OWN EXPORTS (2026-09-07).** The originals were
hand-drawn lookalikes at mixed weights, which is what read as "inconsistent icons". Every
one is now 24x24, `stroke-width: 1.5`, round caps and joins, `currentColor`:

| `col_icon` | Figma layer | node | used by |
|---|---|---|---|
| `mega-style` | `fluent:line-style-sketch-28-filled` (**filled**, takes `fill`) | 6337:4822 | Shop by Style |
| `mega-collection` | `stack-star` | 6337:4858 | Shop by Collection · Wig 101 · Our Heart · All the Ways to Save · Catch Up |
| `mega-color` | `paint-board` | 6337:4885 | Shop by Color · Guides & Answers |
| `mega-bestseller` | `gold-sell` | 6337:4914 | Best Sellers · Dailey Deals rows · Best Seller Style |
| `mega-daily` | `task-daily-02` | 6337:4926 | New markdown daily |
| `mega-calendar` | `calendar-03` | 6337:3921 | This Week's Schedule · Real Women, Real Wigs |
| `mega-live` | `live-streaming-01` | 6337:3943 | Live Tonight |

Two colour exceptions, both modifiers rather than per-column overrides:
- **`gold-sell` is Quaternary `#BC696B`** (`--qi`), not `#A64A4C` — passed as
  `col_icon_tone: 'qi'`. Every other glyph is Primary/Dark Pink.
- **"LIVE TONIGHT · 7:00 PM CT" is the one column LABEL in `#A64A4C`** (node 6337:3942) —
  passed as `col_title_tone: 'accent'`. Every other label is black.

The head geometry is the same everywhere and now exact: 39px tall, glyph top-aligned with a
1px nudge (the frames sit it 1px below the label line, not optically centred), 8px to the
label, Poppins Medium 16/26 uppercase, 1px `#3F3E3E` rule.

**The Kristi signature is ONE reusable element**, `snippets/aria-mega-signature.liquid`. It
is one piece of artwork at two sizes and two colours — Community 249x96.247 black
(6337:4249), Live 120x46.384 white (6337:3949) — so it is drawn as a **CSS mask** with the
colour from `color`, not as an `<img>`. An `<img>` would have needed a second, inverted copy
of a 40-path file. `wp-mega-kristi-signature.svg` feeds both; it is NOT the About section's
`wp-kristi-signature-dark.svg` (different artwork at 345x134 — do not de-duplicate them).

**The Live play affordance is `wp-play-button.svg`, reused.** That asset *is* node 6337:3950
— its Figma frame name `Frame 2147239667` is still inside the file — a 70px frosted disc
(`#C0C0C0` at 50% behind a 16.7px backdrop blur) with a rounded white triangle, and two
other sections already use it. Rendered at the design's 48px, 16px in from the photo's
bottom-right. The earlier inline `mega-play` glyph drew a solid terracotta disc and has been
removed. `<img>` cannot execute the asset's own `foreignObject` backdrop-filter, so the blur
is re-created on `.aria-mega__media-play`.

**Cart tile — two deliberate departures from the frames, both about legibility.** The spec
is a 40px r8 tile, 1px white border, a photo fill, and the 20px white `shopping-cart-02`
centred. The frames' tile happens to carry a mid-dark hair close-up (avg `#6E453D`), so the
white glyph reads; real catalogue shots are frequently near-white, and a white-on-white
add-to-cart button is an invisible *control*, not a cosmetic issue. So the photo carries a
flat **28% black wash** as a second background layer (no extra element), and the earlier
`drop-shadow` on the glyph — which was solving the same problem by invention — is gone.
- **The cart tile's `background-image` was documented but never declared**, so it rendered
  flat cream instead of carrying the product shot. Fixed.
- **The product-card subtitle is BLACK** (node 6316:2379). Primary/Gray is the STYLE-CARD
  subtitle colour (node 6316:3872); reusing it on the product card was wrong.
- **Hover bridge is now geometric, not timed.** The trigger's bottom edge sits **17px** above
  the panel's top — that strip is the nav band's own padding and belongs to neither element,
  so crossing it fires `mouseleave` on the trigger before `mouseenter` reaches the panel. The
  180ms close delay covered it, but that is timing-dependent; the cancel is now bound to
  `.aria-header__nav-band` (the common ancestor of every trigger and panel), so nothing
  closes while the pointer is anywhere in the header. Verified open through the strip for
  600ms — over 3x the delay. Bound once via a `data-` guard, no duplicate listeners.
- **The mega chevron is hidden below 1280.** It only ever announced a desktop panel, so in
  the drawer it read as an expand affordance with nothing to expand (5 were showing). Scoped
  to `--mega` so the real `--dropdown` carets that drive the drawer accordion still work.

**THE GRADIENT SHELL IS NOT ON EVERY PRODUCTS COLUMN.** White->cream at radius 8 with
`padding: 0 20px 20px`, wrapping a column's heading AND its body. Exactly three columns take
it — Start Here products `6337:3548`, Dailey Deals products `6337:4546`, Community CTA
`6337:4239` — and **Best Sellers does not**: `6337:3210` is bare `#FFFFFF` behind the cards
(sampled off the frame). Putting it on `.aria-mega__col--products` unconditionally, as an
earlier pass did, is precisely the unwanted background behind the Best Sellers product
wrapper. It is now the shared `.aria-mega__col--shell` modifier, applied by the `col_shell`
argument rather than inferred from column type, so the three cannot drift apart and the
fourth cannot accidentally inherit it.

**Product badges come from PRODUCT data, not one fixed label.** V4 shows "-30%", "DEAL" and
a collection name across the three Deals cards. Resolution order: a product actually on sale
shows its own discount in **amber** (which reproduces card 1 exactly), else the column's
badge setting with its configured colour, else the best-seller rank. Three badge fills
exist: white, amber `#F79510`, and **pink `#FBB2B2`** (V4's "DEAL" chip). Forcing one label
on every card was wrong.

**Community's CTA card carries the Kristi signature** (node 6316:3459) between the body copy
and the CTA — `wp-mega-kristi-signature.svg`, 249x96 and heart included. It is NOT the About
section's `wp-kristi-signature-dark.svg`: that is different artwork at 345x134 (verified by
comparing path data, so do not "de-duplicate" them).

> **Card width vs header alignment — RESOLVED TOWARD THE DESIGN (2026-09-07).**
> The frames give the mega panel a **20px** inset (1400px of content) while the header row
> keeps 40px: the design deliberately does not align them. An earlier pass matched the
> header instead, and because the widest panels total exactly 1400 that 40px shortfall was
> taken back out of the columns by flex-shrink. It is what wrapped "Wig cap construction
> explained" onto two lines and squeezed every 250px product card to ~237.
>
> `.aria-mega__inner` is now `padding: 20px`, and at a 1440 viewport every column measures
> its Figma width exactly: Shop 260/260/260/244/244 · Best Sellers 300/1061 ·
> Start Here 284/260/801 · Live 375/376/493 · Community 378/515/320 ·
> Deals 260/284/801, with 250px Best Sellers cards. (The products columns read ~15px under
> their 1076/814 because a scrollbar leaves 1385 of the design's 1400 — see the shock
> absorber below.) Alignment with the header and the design's own widths are mutually
> exclusive; the design wins.
>
> **`flex-shrink` IS THE FIT MODEL, and the factors encode priority (revised 2026-09-07).**
> 1280px is the narrowest desktop width the mega menu serves — below it the drawer takes
> over — and at a 1280 viewport a scrollbar leaves ~1225px of content for a design authored
> at 1400. Rather than per-panel media queries, the ~175px shortfall is distributed by a
> WEIGHTED SHRINK, since flex shrinks in proportion to `factor × basis`:
>
> | | factor | why |
> |---|---|---|
> | `--products` | **50** | absorb nearly everything; a card losing width costs nothing |
> | `--promo-card` / `--media-card` / `--photo-row` | 1 | images, they rescale by aspect-ratio |
> | `--menu-padded` / `--menu-divided` / `--style-cards` | **0.35** | shrink last: rows are sized to fit and wrap if squeezed |
> | `--feature-card` | **0** | never — squeezing one breaks its fixed 260/338 inner glass geometry |
>
> At 1225 that gives Shop 243/243/243/199/199 (text needs 209/120/120, so no wrap) ·
> Best Sellers 300 + 901 · Start Here 284/260/641 · Live 363/364/449 ·
> Community 378/485/314 · Deals 260/284/641. At 1440 the design's own numbers apply
> untouched because there is no shortfall to distribute.
>
> This REPLACED a `flex-shrink: 0` + 1280–1439 guard pair, which let **Shop overflow at
> 1280**: it is all fixed-width columns with no products column to give. Do not reintroduce
> a blanket `.aria-mega__col { flex-shrink: … }` override — it flattens the priorities and
> the text columns start wrapping again.
>
> **`letter-spacing: 0` on `.aria-mega`.** `theme.liquid` sets `body { letter-spacing:
> 0.06rem }` and it inherits into the panel, but every type token in the frames is
> letterSpacing 0. That 0.6px added **18px** to "Wig cap construction explained" (271px
> against the design's 254) inside a 260px row — the actual cause of that wrap. Declared
> once at the panel root.

**The three CTA cards are THREE DIFFERENT DESIGNS — never normalise them.** They share only
the "glass" panel recipe (`rgba(255,255,255,0.13)` + `backdrop-filter: blur(50px)` + 1px
white border + radius 4). Everything else differs, and an earlier pass rendered all three as
the Community variant, which is what made them look like one generic card:

| | Best Sellers `6337:3200` | Community `6337:4243` | Dailey Deals `6337:4514` |
|---|---|---|---|
| shell | **white card** holding an r8 photo under a **78% black + angled grey** double overlay, 300x449 | the shared **`--shell` gradient, NO PHOTO**, r8, 378 outer / 338 card | photo at **r4**, **no visible radius on the card**, 260x450 |
| glass | 260x410 centred, p21, items-start | fills card, 410 tall, p21, items-start | **absolute, BOTTOM-ANCHORED**, content-height, p**13**, gap**24**, items-center |
| heading | Montserrat Md 24/32 **white**, **`max-width: 201px`** | Montserrat Md 24/32 **#1F1C1C** | **Poppins Md 18/28 white** |
| body | 18/28 white | **20/28** #1F1C1C | **14/22** white |
| head->body | 4px | 4px | **8px** |
| signature | — | **249x96.25, black, centred** between body and CTA | — |
| button | **white fill, black label** | **black fill** | **terracotta fill** |
| label | SHOP BEST SELLERS | JOIN THE GROUP | SHOP ALL DEALS |

Three things about these cards that each cost a round of debugging:

- **Community looking like Best Sellers was a LIQUID bug, not a CSS one.** The variant CSS
  was already distinct; `aria-mega-column.liquid` rendered `col_image` as an absolutely
  positioned shell photo for *every* variant, which covered Community's gradient and turned
  its glass panel into a dark photo card. The snippet now skips the photo for that variant,
  and `.aria-mega__col--feature-community .aria-mega__feature-shell-img { display: none }`
  is the belt-and-braces half.
- **The Best Sellers heading is width-constrained to 201px**, not full-width. That is how
  "Top 3 this quarter" breaks after "this" into two 32px lines. Left to fill its 218px
  container it sets on one or two lines depending on viewport, which reads as the wrong
  *size* rather than the wrong width.
- **CTA buttons have NO border.** 12 + 28 + 12 = the design's 52px; a 1px border made every
  one 54. Only `--outline` is stroked, and 12 + 28 + 12 + 2 is exactly the 54px the design
  gives *that* button. All of them carry `white-space: nowrap`, which every button node in
  the frames does explicitly.

Driven by `col_variant` (`best-sellers` / `community` / `deals`), passed from the panel
snippet and emitted as `.aria-mega__col--feature-<variant>`. Adding a fourth CTA card = one
variant string + one CSS block.

> **Two height traps in these cards:**
> - **The card height and the glass-panel height are different numbers** (300x449 card
>   holding a 260x410 panel). Feeding the card height into the panel made it 449 tall. The
>   shell owns its height; the panel carries its own. Both are V4 constants in the variant
>   CSS, not settings.
> - **Dailey Deals' panel is `position: absolute` and so is its photo**, which leaves NOTHING
>   in flow — the card collapsed to its 16px of padding. That variant needs an explicit
>   `min-height: 450px`.

**Full-bleed background, CENTRED content container.** `.aria-mega` spans 100% of the
viewport so the white ground and shadow run edge to edge; `.aria-mega__inner` is the
container and is deliberately not full width:

```css
.aria-mega__inner {
  max-width: calc(var(--container, 1360px) + 80px);  /* the theme's global token */
  margin-inline: auto;
  padding: 20px 40px;   /* 20 block = V4's panel padding; 40 inline = the header's gutter */
}
```

Those three values are copied from `.aria-header__nav`, not invented, so the panel lines up
with the header above it — measured identical at every width (x40->x1385 at 1440,
x273->x1633 at 1920 with ~272px of whitespace each side). The ticker STRIP stays full-bleed
(V4 centres its text across the whole width) but its text sits on the same container so it
aligns with the columns.

> **The container is 1360, V4's panel is 1400.** V4 gives the mega panel 20px gutters while
> the header row gets 40px, so the design's panel content is 40px wider than the site
> container. Aligning with the header (the explicit requirement) therefore costs Shop 1px
> per column: its V4 row totals 1364 and cannot fit 1360. Every other panel is exactly V4
> at a true 1440. Do not "fix" that 1px by shrinking the 24px column gap.

**Shared V4 vocabulary** (verified against the live DOM, all exact): panel padding 20px ·
column head = 24px icon + 8px + 16/26 weight-500 uppercase over a 1px `#3f3e3e` rule with
12px under it · 20px head-to-body · list gap 12px · radius 8 on media, 2 on buttons ·
chip 18px tall, `#fff` or `#f79510` · promo 244x315 with a 36px `#a64a4c` CTA · product
media 250x315 with a 40px cart button.

Column widths are literal arguments in `aria-mega-menu.liquid` holding the Figma numbers.
**Products and Community-CTA columns take their OUTER width** — the 20px shell padding is
inside it, so the cards divide the remainder into exact 250s:
Shop 260/260/260/244/244 · Best Sellers 300/**1076** · Start Here 284/260/**814** ·
Live 375/376/493 · Community **378**/515/320 · Deals 260/284/**814**.
Passing the inner width (1036 / 774 / 338) is what shrank every card by ~10px.

**The right-hand void is `margin-left: auto`, and with these widths it is exact.** Shop's
1268 of columns plus four 24px gaps leaves 36px of slack, which lands on top of the gap
before column 4 → the design's **60px** void. Live's leaves 108 → its **132px** void.
Community carries no `col_push`, so its 139px of trailing space is reproduced too.

**Parent hover / active state.** The open parent is a pale pink PILL —
`background-color: #EBD8D9` (`--pink-tint`) on a 120px radius — with the label still
**black**. An earlier pass turned the label terracotta with no pill, which was wrong on both
counts. Nav items are `padding: 4px 8px` on a **12px** gap. Because hover and open share the
same pill, the parent's appearance never changes as the cursor travels into the panel, so
there is nothing to flicker.

> **THE CHEVRON STAYS VISIBLE WHEN THE PANEL IS OPEN.** (The second half of this note --
> "and only three parents have one" -- was superseded on 2026-09-08; see below.)
> Both of those were wrong before (2026-09-07):
> - The approved frames draw the chevron **inside the open pink pill** — see the pilled
>   "Best Sellers ⌄" in `6337:3148`, "Shop ⌄" in `6337:4768`, "Start Here ⌄" in `6337:3448`.
>   An earlier pass read V4 as hiding it and shipped
>   `.aria-header__menu-link[aria-expanded='true'] .aria-header__menu-caret { opacity: 0 }`,
>   which is the reported "arrow disappears on hover". **That rule is deleted, deliberately;
>   nothing replaces it.** The caret keeps the same 14px `arrow-up-01`, 1px stroke, 4px
>   offset and `currentColor` (black inside the pill) in both states.
> - ~~**Only Shop / Best Sellers / Start Here carry a chevron at all.**~~ **NO LONGER
>   TRUE — superseded 2026-09-08.** It was true of the frames: Live showed its red dot,
>   and Community and Dailey Deals showed nothing even when pilled open (verified on
>   `6337:4462`), so 3 chevrons rendered rather than 6. The client has since asked for one
>   uniform affordance, so **all 6 render** and the arrow is derived from `has_mega`
>   instead of a hand-kept `mega_caret_list`. The glyph, size, stroke, 4px offset and
>   `currentColor` are unchanged — only WHICH items get one. See "Uniform parent chevron"
>   in 4.6g.

> ⚠️ **Measuring that pill:** it has a `transition`, and a hidden preview pane does not
> advance transitions — every computed read returns the FROZEN START FRAME (transparent),
> which looks exactly like the rule never applied. It survived two rounds of "fixes" for a
> bug that did not exist (specificity, then longhand-vs-shorthand) before the artifact was
> spotted. Inject `transition: none` before reading, or you will chase nothing. The giveaway
> was that inline `!important` also "lost", which is impossible in the real cascade.

**Gotchas worth keeping:**
- **Panels are siblings of the nav, inside `.aria-header__nav-band`** — never inside the
  `<li>`. `.aria-header__menu-item` is `position: relative` from 1280px up, so a nested
  panel would be trapped in a ~100px containing block instead of spanning the viewport.

> **THAT SIBLING PLACEMENT MADE THE PANELS KEYBOARD-UNREACHABLE, and it needed a JS
> bridge (fixed 2026-09-07).** Because the panels sit far later in document order than the
> nav, a forward Tab off an open trigger went to the **next nav item** — measured **46 tab
> stops** between the "Start Here" trigger and the first link inside its own panel. The
> panel's `focusout` handler then closed it, and by the time the tab order finally reached
> the panels every one was `hidden` and so not focusable at all. Opening on `focusin` alone
> never delivered what the old comment claimed ("the links inside are reachable by tabbing
> forward") — the contents were unreachable by keyboard entirely.
>
> `aria-mega-menu.js` now implements the ARIA APG disclosure-navigation behaviour: a
> forward **Tab** or **ArrowDown** on an open trigger moves focus to the panel's first
> focusable element, and **Shift+Tab** off that first element returns to the trigger
> (which keeps the panel open, because the `focusout` guard already exempts the trigger).
> Verified: closed panel → Tab behaves normally; open panel → Tab enters; Shift+Tab is
> never hijacked on the trigger; the whole bridge is gated on `isDesktop()` so at 375px
> neither Tab nor ArrowDown is intercepted. Hover, Escape, click-outside and the
> focusout-close are untouched.
>
> Do NOT "simplify" this away by moving the panels into the `<li>` — that reintroduces the
> containing-block bug above.
- **`range` settings are capped at 101 steps.** A 0-1200px width range as a `range` breaks
  the whole schema (and then cascades into "Invalid value for type in block" on
  `header-group.json`, which is misleading — fix the range, not the group). Widths and
  heights are `number` settings.
- **The right-hand group's gap is `margin-left: auto`, not a hardcoded value.** With the
  Figma column widths that yields Shop's 60px void by itself. Community is the one panel
  whose last column is NOT flush right, so its `col3_push` is off.
- **Keep the shrink guard under 1400px.** V4's Shop panel needs 1380px + scrollbar, so the
  design fits from ~1395 up. An earlier guard ran to 1499 and silently replaced the design's
  24px gap with 16px at 1440, the primary reference width.
- **Feature-card heights cannot be derived from the width** (V4: 300x449, 338x410, 260x450)
  — hence the explicit `col*_height` setting.
- **Photo-row stagger needs unequal flex-grow.** `flex: 1 1 0` on all three made them equal
  width, so the differing `aspect-ratio`s produced a 1px height difference. The grow values
  ARE V4's widths (158/176/158), which yields 214/238/214.
- **`<product-form>` collapses to 0px as a flex item.** The add-to-cart reuses the theme's
  `aria-product-card-quick-add` snippet (so the AJAX cart drawer is shared, not
  reimplemented) but the wrapper needs an explicit `width: 40px` or the button overlaps the
  subtitle.

> ## ⚠️ THE QUICK-ADD WRAPPER IS `opacity: 0` BY DEFAULT — RESET IT (fixed 2026-09-07)
>
> Reported as "mega menu product cart icon is not showing", and it was invisible on any page
> that loads `component-aria-product-card.css`. That stylesheet hides the shared quick-add
> and reveals it on **card hover**, which is correct for the section product cards:
>
> ```css
> @media screen and (min-width: 750px) {
>   .aria-product-card__quick-add { width: 0; opacity: 0; overflow: hidden; }
>   .aria-product-card:hover .aria-product-card__quick-add { width: 54px; opacity: 1; }
> }
> ```
>
> The mega menu reuses that snippet but its cards are **`.aria-mega__product`, not
> `.aria-product-card`**, so the reveal selector can never match and the control stays
> transparent forever. `.aria-mega .aria-product-card__quick-add` now sets
> **`opacity: 1; overflow: visible`** alongside its `width: 40px`.
>
> **WHY EVERY CHECK MISSED IT, and what to assert instead.** An `opacity: 0` element still
> takes layout and still hit-tests, and the override's `width: 40px` already beat the
> `width: 0`. So the tile reserved its exact 40px, every computed style **on the button**
> read correctly (40x40, radius 8, white border, white `currentColor`, scrim present, the
> right SVG path at 20x20), and `document.elementFromPoint` at its centre returned the icon.
> It simply painted nothing. The one wrong value was on the **wrapper**, which is the single
> element none of those probes looked at. When verifying this control, assert
> `getComputedStyle(wrapper).opacity === '1'` — geometry and hit-testing cannot detect it.
>
> Two diagnostic dead ends worth not repeating: cloning the button into an overlay to zoom
> it drops both the `.aria-mega` colour rule and the photo custom property (so it renders
> pink on white and looks like a different bug), and `transform: scale()` on the foot
> interacts with its `backdrop-filter`. Enlarge the real element with `width`/`height`
> instead.
>
> **THE INSTAGRAM FEED HAS THE SAME LATENT BUG** — verified live: `.aria-insta__bar`
> overrides the button but never the wrapper, so its 5 quick-adds sit at `opacity: 0`,
> `width: 0`, `overflow: hidden` with a 44px button clipped inside. Left alone as
> out-of-scope for the mega-menu work; it needs the same two-property reset.
- Product titles are clamped to 2 lines: V4 mocks a two-word label, real Belle Tress titles
  run 60+ characters and took three lines.
- **Mega menu is 1280px-and-up only.** Panels are `display: none` below that and the JS is
  gated on `matchMedia`, so the tablet/mobile drawer is untouched. Re-verified 2026-09-07 at
  1024 and 375: panels `display: none`, drawer opens with all 7 items at 46px, no horizontal
  overflow, mega chevrons still hidden in the drawer (they announce a panel that does not
  exist there) while real `--dropdown` accordion carets are untouched.
- **`shopify theme check` OOMs on this theme** with the current CLI (Node heap exhausted
  after ~220s, `FATAL ERROR: Ineffective mark-compacts near heap limit`). Raise it with
  `NODE_OPTIONS=--max-old-space-size=8192` and write straight to a file — piping through
  `grep`/`tail` buffers everything and you see nothing if it dies.

**Best Sellers is automatic.** Source resolution order, all in the collection's own sort
order: the block's collection setting -> a collection handled `best-sellers` ->
`collections.all`. Set that collection to "Best selling" in Admin and it is a live feed.
Unavailable products are skipped; drafts never reach Liquid. No manual product list anywhere.

**Missing-content fallbacks (so no panel ever shows a headed but empty box).** Three layers
in `aria-mega-column.liquid`, most-preferred first:
1. **Placeholder rows** — each Figma frame's own row labels, passed per column from
   `aria-mega-menu.liquid` (`ph_shop_collection`, `ph_live_catchup`, …). Used ONLY while that
   column's Shopify menu is missing; real items take over the instant it exists. Gated by the
   section setting **`mega_show_placeholders`** — **turn it OFF before launch** so shoppers
   never see example links. 33 rows + 5 style rows render today.
2. **Images** — the block's own image, else a real product shot from the column's collection
   or the catalogue, and only then Shopify's line-art placeholder. Wireframe count is now 0;
   a real photo reads far closer to the design.
3. **Links** — the column's collection URL, else `routes.all_products_collection_url`. No
   `href="#"` remains anywhere in the panels.

> **Two Liquid traps this exposed, both worth remembering:**
> - **`col_menu.links.size == 0` is NOT a safe emptiness test.** For a nil menu the size is
>   nil, and `nil == 0` is **false** in Liquid, so empty columns silently skipped their
>   placeholders. Ask `> 0` and invert (`menu_has_links`).
> - **A menu setting arrives in two shapes.** A preset string handle works with
>   `linklists[handle]`; a `link_list` PICKER hands you the object, and passing that through
>   `linklists` yields nil. The snippet now tries the lookup and falls back to using the
>   param directly — that is what was breaking Shop by Style.
> - Building Liquid with regex replacements: a `\"` in a Python regex REPLACEMENT string
>   survives into the output, emitting `class=\"...\"` and silently breaking every
>   attribute. The rows rendered but matched nothing. Check for `\"` after any such edit.

> **The eight mega-menu Shopify menus DO NOT EXIST on this store** (re-verified twice, most
> recently during the audit pass, two levels deep — by
> probing each handle plus 19 plausible variants: every one returns an EmptyDrop, 0 links,
> blank title, while `navigation` returns 7, `main-menu` 20, `footer` 6). Menus are
> store-level, so this is not a theme issue. The handles are wired exactly as given and the
> columns will populate the moment the menus are created. Both list renderers were proven by
> temporarily pointing two columns at the real `footer` menu (12 links rendered) and then
> reverted. Only `navigation`, `main-menu`, `footer`, `tutorials` and
> `customer-account-main-menu` exist today.

### 4.6f Mobile drawer navigation (below 1280px)

`snippets/aria-mobile-nav.liquid` + `assets/component-aria-mobile-nav.css` +
`assets/aria-mobile-nav.js`, rendered once from `sections/header.liquid`.

**A different interaction pattern over the same content — not a narrow mega menu.**
Desktop is hover + a full-bleed panel of columns; mobile is tap + a nested drawer that
drills down one level at a time.

**ONE BREAKPOINT, 1280px, and no overlap.** It is the same boundary the header already used
to swap its inline nav for the hamburger, so there is exactly one number:

| | ≥ 1280px | ≤ 1279px |
|---|---|---|
| `.aria-mega` panels | hover-driven | `display: none` |
| `.aria-header__nav-panel` | the inline desktop nav | `display: none` |
| `.aria-mnav` drawer | `display: none` | the navigation |

**Two levels, drill-down not accordion.** Each level is an absolutely-positioned layer
filling the drawer; level 2 sits at `translateX(100%)` and slides OVER level 1, which drifts
to `-18%` as a depth cue. Nothing expands underneath a parent row. `hidden` is removed
before `.is-active` is added and restored after the slide, so an off-canvas panel is never
in the tab order.

**Back and Close are different controls with different jobs** — Back (level 2 only) returns
to level 1 and never closes; Close exits from either level. Escape is level-aware: it steps
back out of a child and only closes from the top. Both are 44px.

**Content is the mega-menu blocks, shared not duplicated.** Level 2 renders
`aria-mega-menu` with `context: 'mobile'`, so the columns, menus, headings, icons, feature
cards, promo cards, photo rows and media card are the SAME definitions desktop uses. Adding
a column or changing a handle updates both. The presentation differs in CSS only.

> **The one content difference is product cards, and they are NOT rendered.**
> `aria-mega-column` skips the whole `products` column (head included) when
> `col_context == 'mobile'`. `display: none` would have been wrong — the markup, the
> `<product-form>` elements and every `image_url` would still be emitted, and the brief
> requires the desktop product grid not be loaded in the drawer at all. Desktop product
> data and rendering are completely untouched; only the `products` call sites pass
> `col_context`, because every other column type adapts in CSS.

**Feature cards stay four different designs on mobile.** Only the fixed pixel geometry is
released (`width: 100%`, content height, `clamp()` type). Best Sellers keeps its photo under
the dark double overlay, Community its photo-less gradient shell and centred signature,
Deals its bottom-anchored panel and sharp corners, Live its signature and frosted play disc.
The signature becomes `width: min(<w>, 100%)` + `aspect-ratio` — hence the
`--aria-mega-sig-ar` custom property, since CSS cannot divide the w/h properties.

**Gotchas that cost real debugging time here:**

- **`div:empty { display: none }` in `base.css` (line 483) killed the backdrop.** The
  overlay is an empty `<div>` by design; that rule is specificity (0,1,1) and beat the
  single class, so it measured 0x0 — the page was never dimmed AND tap-outside-to-close
  silently did nothing because the pointer fell through to the page. Fixed with
  `.aria-mnav .aria-mnav__overlay` + an explicit `display: block`, NOT an inert child
  (which the next tidy-up would delete).
- **The desktop guard must be CSS, not JS.** Every drawer rule lives inside
  `max-width: 1279px`, *including* `.aria-mnav[hidden]`'s own `display: none` — so above
  1280 an un-hidden drawer falls back to a static `<div>` and dumps seven levels of menu
  into the page. The JS closes on a `matchMedia` change, but that event does not always
  arrive on a resize (it did not under viewport emulation), which left an open drawer over
  the desktop nav. `@media (min-width: 1280px) { .aria-mnav { display: none } }` makes it
  unconditional.
- **The body-scroll-lock rule is scoped to mobile too.** Left outside the media query, a
  stale `.aria-mnav-open` locked the PAGE at desktop widths with nothing to remove it.
- **The close timer had to be guarded.** `close()` defers `hidden` + level reset until the
  slide-out ends; tapping the hamburger twice quickly let that callback fire against an
  already-reopened drawer and hide it — `is-open` true, drawer invisible. `finish()` now
  bails if the drawer has been reopened.
- **Images inside a `hidden` panel resolve `srcset` with zero layout width** and take the
  smallest candidate — feature photos were decoding at 112-130px for a 312px slot. Fixed by
  giving them an explicit `sizes`, which the browser uses instead of layout width. `lazy`
  loading is kept: a level-2 panel's images only fetch when that panel is opened.

### 4.6g Header search — the 1280–1335px compact toggle

**The bug.** The nav row must hold the logo, the seven-item menu, a 248px search pill and
three icon buttons. `.aria-header__nav-right` is `flex: 0 0 auto`, so when the row runs
short it is `.aria-header__nav-left` that shrinks — and the menu `<ul>` inside it does not
shrink with it, because every item is `white-space: nowrap`. The list overflows its
container and lands ON TOP of the search pill. Measured `menu.right − search.left`:

| viewport | 1440 | 1425 | 1420 | 1415 | 1400 | 1336 | 1300 | 1280 |
|---|---|---|---|---|---|---|---|---|
| overlap | −20 | −5 | 0 | **+5** | **+44** | **+108** | **+144** | **+164** |

At 1300 that put "Dailey Deals" through the search placeholder and the PRE-ORDER button
over the field.

**The fix.** In `1280px–1335px` the inline pill collapses to the icon trigger the header
already ships for mobile, reclaiming `248 − 36 = 212px` — more than the 164px worst case —
and the expanded field becomes a **right-anchored dropdown below the nav row**, where it
cannot touch the nav, logo or icon buttons. Inline expansion was rejected: inline growth is
what caused the problem, and there is no spare width in this range.

**No JavaScript was needed.** The trigger and panel already exist, and `aria-header.js`'s
generic `[data-aria-toggle]` handles click-to-open, click-to-close, outside-click and
Escape, with `aria-controls` / `aria-expanded` already on the button. The whole feature is
one media query plus a two-glyph trigger (search ⇄ close, mirroring the hamburger).

Verified clearance in-range: 1335 → 103px, 1320 → 88px, 1290 → 58px, 1280 → 48px. Header
stays 68px, no overflow, no clipped or wrapped nav labels, expanded panel always below the
nav row and inside the viewport with a 280px input.

*(Those four figures predate the 2026-09-08 chevron/inset pass. Re-measured after it:
1335 → 131px, 1320 → 116px, 1290 → 86px, 1280 → 76px — the range got roomier, not
tighter. See the revised table below.)*

> **⚠️ THE REGRESSION THIS SHIPPED WITH, AND THE RULE IT TEACHES (fixed 2026-09-07).**
> The trigger carries two glyphs so it can become a close control. The first pass put
> `.aria-header__search-icon-close { display: none }` INSIDE the 1280-1335 media query — so
> at every OTHER width the close glyph had no rule at all and rendered next to the
> magnifier. Mobile and tablet search buttons showed `🔍✕` side by side in one 44px control.
> Only ≥1336 escaped, and only because the trigger is `display: none` there.
>
> **The swap was defined without ever defining the state it swaps away from.** The resting
> state now lives unscoped next to `.aria-header__search-trigger`; the media query holds
> only the `[aria-expanded='true']` exception.
>
> RULE: markup added for one breakpoint is GLOBAL, so its resting state must be global too.
> Put the default in the base layer, and give the media query nothing but the exception.
> Never both.

**Two things this exposed, both fixed:**

- **The body scroll lock had to be scoped below 1280.** `aria-header.js` sets
  `.aria-header-drawer-open` whenever a search panel opens, which is right for the
  full-screen mobile overlay but would have locked the whole page behind a small header
  dropdown — newly reachable the moment the search became openable at a desktop width.
- **`closePanel` now returns focus to the trigger** instead of only blurring the input.
  Blurring alone dropped focus to `<body>`, so Escape out of the search field sent the next
  Tab back to the top of the document. Always wrong, but easy to hit here because in this
  range the field is only reachable by operating the toggle.

> **⚠️ THE OVERLAP IS NOT FULLY CLOSED: 1336–1419 STILL OVERLAPS.**
> The table above shows the inline pill only clears from **1420px** up, so the band
> **1336–1419** still overlaps by 5–108px. The approved requirement fixed 1336+ as
> "existing desktop search unchanged", so that band was deliberately left alone rather
> than silently widened.
>
> The one-line change that would close it is the upper bound of the compact-search media
> query: `max-width: 1335px` → `max-width: 1419px`. Nothing else needs to move. Raise it
> with the client before applying — it changes the search presentation at widths they
> signed off as unchanged.
>
> **STILL OPEN after the 2026-09-08 pass, and 20px narrower.** Re-measured with the six
> chevrons and the 20px row inset in place: 1336 **+80**, 1360 **+56**, 1400 **+16**,
> 1401 **+15**, then clean from 1420 (**−4**), 1440 (**−24**) and 1460+ (**−39**). So the
> band is now **1336–1419** at +15…+80 — better than the +5…+108 above, but the same
> unresolved band, and the same one-line remedy.

### 4.6g-2 Uniform parent chevron (2026-09-08)

**What changed.** Every parent that owns a dropdown or a mega panel now draws the chevron;
items with no panel draw nothing. Previously only Shop / Best Sellers / Start Here had one,
from a third parallel list (`mega_carets`) in `header.liquid`. That list is **gone** — the
nav loop tests `has_mega`, the same fact that wires the trigger and the drawer panel, so a
parent cannot gain a panel without gaining its arrow. **6 chevrons render, not 3.**

Two knock-on edits, both deliberate:

- **The Shopify-submenu branch now renders the same glyph.** It used the theme's chunkier
  `chevron-down`, so a submenu parent and a mega parent could sit in one nav with two
  different arrows at two different stroke weights. Both now render `mega-chevron` (the
  frames' own 14px `arrow-up-01`) through `.aria-header__menu-caret`. The 180° flip that
  branch takes while its accordion is open stays — it is a click disclosure and the flip is
  its open-state cue; the hover-driven mega parents have the pink pill instead and their
  arrow does not move.
- **`show_dot` no longer suppresses the chevron.** Live shows its red dot *and* its arrow,
  which is what the mobile drawer has always done. The dot is in flow and superscripted, so
  on Live the arrow sits 4px after the DOT rather than 4px after the word.

**THE 54px PROBLEM, AND WHERE IT CAME FROM.** Three more 14px glyphs at a 4px offset is
+54px of nav, and the row did not have 54px. `menu.right − navRight.left` went from
−6 / −26 / −41 at 1420 / 1440 / 1460+ to **+48 / +28 / +13** — the PRE-ORDER pill running
into the search pill on an ordinary laptop — and above ~1460 it could never clear, because
the row is capped at `--container + 80` and the overlap just plateaus.

The 54px was taken from the **shell, not the nav items**. Nothing the frames specify for a
nav item moved: the 12px item gap, each item's 8px gutter, the 14px chevron and its 4px
offset, the 248px search pill and the 152px wordmark are all unchanged. What gave way, both
at `min-width: 1280px`:

| | was | now | reclaims |
|---|---|---|---|
| `.aria-header__nav` `padding-inline` | 40px | **20px** | 40px |
| `.aria-header__nav-left` `gap` | 28px | **16px** | 12px |

That 20px inset is not arbitrary: `.aria-mega__inner` is `padding: 20px` inside the same
`--container + 80` cap, so the row and the panel beneath it now share **one 1400px content
box** and their left and right edges line up. The 40-vs-20 mismatch flagged as a trade-off
in §4.6 is closed by this.

A **third** fix came out of the same measurement: a stale
`@media (min-width:1280px) and (max-width:1400px) { .aria-header__menu { gap: 16px } }`
override made the nav **24px wider in the range with the least room** than at 1401+, where
the `>=1280` block's approved 12px applies. It reads like a leftover from the pass when the
base gap was 32px (16px was a reduction then; it silently became an increase when the base
became 12px). Retired — the desktop gap is one number at every width now.

**Net result — parity with the pre-chevron header at every width, and better below 1400:**

| viewport | 1280 | 1336 | 1401 | 1420 | 1440 | 1460+ |
|---|---|---|---|---|---|---|
| before (3 chevrons) | −54 | +102 | +13 | −6 | −26 | −41 |
| after (6 chevrons + shell) | **−76** | **+80** | **+15** | **−4** | **−24** | **−39** |

Verified across 375 → 1920: below 1280 the desktop nav panel is `display: none`, so **0 of
the 6 chevrons paint** and the drawer's own `arrow-right` (`.aria-mnav__chevron`) is
untouched; from 1280 up all 6 paint at 14×14, 1px stroke, `currentColor`, 4px offset and
0px vertical-centre error; no chevron overlaps its label at any width; no horizontal scroll
at any width; and rest → open changes only `color` (to the pill's black) with no move, no
resize and no layout shift.

### 4.7 Cards

- **Product card (V4 light):** width `331px`, `gap 20px`, `radius 2px`,
  **transparent background, no padding** — sits directly on the section gradient.
  (The earlier dark variant used a white card with 16px padding; that is superseded.)
- **Collection card:** image + centred title below, CSS `scale(1.05)` hover on the image.

### 4.8 Image treatment

- Product card media (Best Sellers): aspect ratio **`331 / 320`**, `object-fit: cover`,
  **`radius 4px`**. Verified against V4 `1:473` — the media fills the 331px card width and
  is 320px tall. The previously documented `228 / 240` at `radius 2px` was wrong and made
  the media ~28px too tall.
- Collection card media: aspect ratio `320 / 418`.
- Always use Shopify's `image_url` + `image_tag` with `widths`/`sizes` for responsive
  srcset. `loading: 'lazy'` below the fold, `'eager'` + `fetchpriority: 'high'` for the hero.

---

## 5. CSS Architecture

- **One stylesheet per section**, named `assets/section-aria-<section>.css`, linked from
  the section's own Liquid via `{{ 'file.css' | asset_url | stylesheet_tag }}`.
- **Namespace every class** `aria-<section>__<element>` (BEM-ish). Never use generic
  class names (`.card`, `.price`, `.title`, `.btn`) — they collide with Dawn.
- **No `!important`.** No global element selectors. No CSS frameworks.
- Reuse `style.css` tokens rather than re-declaring values.
- Dawn's `base.css` is shared with stock templates — **do not edit it**. Override only
  within section-scoped selectors.

### Known Dawn CSS gotchas (hard-won — do not regress)

1. **`:empty { display: none }`** — Dawn's `base.css` hides *any* empty
   `div`/`section`/`p`/etc. Purely decorative empty elements (gradient overlays, progress
   bars) are silently hidden. **Fix:** give them an inert child (`<span></span>`).
2. **`.shopify-section-group-header-group`** has `z-index: 4` from Dawn but is
   `position: static`, so the z-index is inert. The custom header sets
   `position: relative` on it so dropdowns/overlays stack above following sections.
3. **`<details>`/`<summary>` cannot be force-opened by CSS.** A closed `<details>`
   suppresses its content regardless of `display`. The header therefore uses
   plain buttons + `aria-expanded` + an `.is-open` class, driven by `aria-header.js`.
   **Do not reintroduce `<details>` for anything that must be visible at desktop.**
4. **`box-sizing` is NOT reliably `border-box` here — state it explicitly on any element
   with both `min-height`/`width` and padding or a border.** Several card elements resolve
   to `content-box`, so the declared size is *added* to padding and border. The
   `View Product` button (`min-height: 52` + `12px` padding + `1px` border) rendered
   **78px** instead of 54, and the 28px wishlist button rendered 30px. Both looked like
   spacing bugs and were actually box-model bugs. Always assert the rendered height.
5. **A broad descendant rule silently out-specifies your overlay classes.**
   `.aria-x__media :is(img, video, iframe) { width:100%; height:100% }` scores **(0,1,1)**
   — a class plus the type selector `:is()` inherits — which beats a plain
   `.aria-x__play` **(0,1,0)**. Every overlay (play glyph, signature) then gets stretched
   to fill the whole frame, with no error anywhere. Caught in Why Wig Party, where the
   70×70 play button measured 679×380. **Scope media sizing to explicit classes**, never a
   blanket descendant selector, and assert overlay sizes from the live DOM rather than
   assuming the CSS applied.
6. **The header group is a `z-index: 4` ceiling — nothing in a later section may exceed
   it.** Dawn's `base.css` gives `.shopify-section-group-header-group` `z-index: 4`, and
   because gotcha 2 makes it `position: relative` it is also a **stacking context**. Every
   header overlay is therefore *trapped* inside it: the search dropdown's own `z-index: 20`
   and the mobile search panel's `40`/`50` all flatten to **4** as far as the rest of the
   page is concerned. Meanwhile a section's own `z-index` competes in the **root** stacking
   context whenever all its ancestors are `static`/`auto` — which is the normal case, since
   Shopify's `.shopify-section` wrapper is `static`. `.aria-hero__inner` had `z-index: 10`
   for no reason (it only ever needed to beat `.aria-hero__media`, which precedes it in the
   markup at `z-index: auto`, so `1` suffices), and that `10` painted the hero copy panel
   **over the open search dropdown and swallowed every click on a suggestion**. There is no
   visual symptom — the dropdown looked perfect, it was just unclickable.
   **Rule: keep every section's `z-index` ≤ 3.** To diagnose, never trust the CSS: probe
   `document.elementFromPoint(cx, cy)` at the centre of the element you want to click and
   confirm it returns that element (or a descendant). Raising the header group above 4 is
   *not* the fix — it is shared with the stock templates.
7. **A full-bleed wrapper around a narrow column eats clicks on whatever sits under the
   empty part of it.** `.aria-hero__inner` is full-width/full-height at ≥990 but its only
   visible content is a 607px column on the left, so the empty right-hand two thirds
   covered the Watch Live badge (which lives *inside* `.aria-hero__media`, earlier in the
   markup) and made it a dead button — again with no visual symptom. **Fix:** `pointer-events:
   none` on the wrapper and `pointer-events: auto` back on the single content child. Check
   for this on any section where a positioned overlay and a full-bleed copy wrapper share
   a box.

---

## 6. JavaScript Architecture

Vanilla JS only. No jQuery. All scripts `defer`. Section-scoped, delegated listeners.

| File | Responsibility |
|---|---|
| `aria-header.js` | Mobile nav + search toggles (`[data-aria-toggle]` ↔ `aria-controls`), Escape-to-close, mobile submenu accordions. |
| `aria-product-carousel.js` | **Shared** Swiper init for every `[data-aria-product-carousel]`. Config via data attributes (`data-slides-mobile/-sm/-md/-desktop`, `data-space-between`); optional progress fill and prev/next. Re-inits on `shopify:section:load`. |
| `aria-product-card.js` | **Shared** colour-swatch → variant selection: swaps the primary image, repoints the quick-add variant id, refreshes price/availability. Delegated at document level so it works in any section; state is per card element. See §6a. |
| `aria-wishlist.js` | `localStorage`-backed wishlist toggle (`[data-wishlist-toggle]`, key `ariaWishlist`, stores product IDs). |
| `aria-video-controls.js` | **Shared, page-wide.** Autoplay-muted-inline, the custom play/pause + mute/unmute buttons, and the ONE global single-audio rule for every managed video (Real Customers slides *and* Why Wig Party). Opt-in purely via markup, so a future section joins with no change. See §9a. |
| `vendor-swiper-bundle.min.js` | **Swiper v11.2.10, self-hosted.** |

> `aria-best-sellers.js` was **removed**: its Swiper/progress logic became
> `aria-product-carousel.js` and its swatch handler became `aria-product-card.js`, so
> Best Sellers and New & Trending share one implementation instead of two copies.

> **Swiper is already vendored.** Any new carousel MUST reuse
> `vendor-swiper-bundle.min.js` / `.min.css`. Do **not** add a CDN tag or a second copy.

### 6a. Colour swatches -> selected variant -> Add to Cart (2026-09-08)

The swatch row is a **variant picker**, not decoration. Three files cooperate:
`snippets/aria-product-card.liquid` resolves the data, `assets/aria-product-card.js` owns
the interaction, `assets/component-aria-product-card.css` owns the box model. All three are
shared by Best Sellers **and** New & Trending (`--compact`), so a change here lands in both.

#### State model (per card, never global)

`assets/aria-product-card.js` hangs one object off each card element,
`card.__ariaSwatchState`, created lazily on first click:

```
selectedSwatch        the <button> currently ringed
selectedVariantId     what the quick-add form will submit
selectedVariantImage  the src currently displayed
defaultVariantId      product.selected_or_first_available_variant, read from the form input
defaultImage          {src, srcset, alt} of the Liquid-rendered featured image
defaultPrice / defaultComparePrice
imageToken            monotonic; a stale image load that lost the race is discarded
```

Every lookup is rooted at `card` (`card.querySelector`, never `document.querySelector`).
That is what keeps two cards in one carousel independent: selecting Blonde on product A
cannot touch product B image, ring or variant. **Verified** — after driving A then B, A
still reported its own selected index and its own form id.

A click does four things, in order: move the ring + `aria-pressed`, repoint the variant id,
swap the image, refresh the price.

#### Add to Cart is NOT reimplemented

`<product-form>` (`assets/product-form.js`) still owns the entire submit path: AJAX,
cart-drawer render, count bubble, loading state, spinner, success, error handling,
quantity. The swatch handler only writes `input[name="id"]` inside
`.aria-product-card__quick-add-form`. With no swatch selected the Liquid default
(`selected_or_first_available_variant`) posts, exactly as before.

An unpurchasable colour sets `aria-disabled` on `.aria-product-card__cart-btn`, which
`product-form.js` already honours, because the quick-add form runs with
`data-hide-errors="true"` — without this, adding a sold-out colour failed **silently**.
A `--sold-out` product is left alone: Liquid already disabled it for every colour.

#### Two Liquid bugs this fixed

1. **`variant.option1 == value` is always false.** `option.values` yields
   `product_option_value` **drops** on current API versions while `variant.optionN` is a
   string, so the comparison never matched: *every* swatch resolved to no variant, shipped
   no `data-variant-id` and no image, and the card went on submitting the default variant
   however many swatches you clicked. Normalise first —
   `assign value_string = value.name | default: value | strip` — because `strip` forces
   `to_s` on a drop and is a no-op on a string, so one expression covers both API shapes.
   Dawn hits the same trap and side-steps it with `value | escape`; do **not** use `escape`
   for comparison, it mangles any value containing `&`.
2. **The ring and the posted variant were resolved independently,** so they could disagree.
   Both now derive from a single `card_variant` assign (see *Initial state* below), which
   makes disagreement structurally impossible.

Per-colour variant resolution prefers an **available** variant for that colour and falls
back to a sold-out one only when the colour has none — otherwise a product with a second
option can resolve to a dead variant.

#### Instructional pseudo-values are not colours

Most Belle Tress products carry an extra colour option value whose name is a prompt —
`"Choose Color From Drop Down"` / `"Choose Color From Dropdown"` — so the product page
dropdown opens on an instruction instead of a colour. It is **not** a colour, and it is
first in the option order, which made it poison three things at once: a swatch whose
tooltip read "Choose Color From Drop Down", the card's default variant, and (because it is
permanently sold out) a quick-add button that shipped disabled.

`swatch_prompt_fragments` in `aria-product-card.liquid` holds the lowercase fragments
(`choose`, `dropdown`, `drop down`) and any value containing one is skipped **everywhere**
on the card: the swatch row, `swatch_colour_count`, and the first-colour resolution that
feeds `card_variant`. Add a fragment there if another spelling turns up.

This matches on prompt **wording**, not on a colour name, so the "never hardcode variant
ids / colours / images / variant names" rule still holds — no colour is special-cased, and
a product with no such value is unaffected.

Two knock-on details that are easy to get wrong:

- **`swatch_rendered_count`, not `forloop.index`, drives the hidden-overflow flag.** Using
  the loop index counts the skipped prompt value as a visible slot and leaves the row
  showing four colours behind a "+N more" button.
- **`swatch_colour_count`, not `values.size`, drives "+N more colors".** Otherwise the
  count is one too high.

Verified across all 12 cards: first swatch is a real colour on every one, totals dropped by
exactly one (13→12, 11→10, 12→11), the counts re-derived correctly (+8→+7, +6→+5, +7→+6),
five visible everywhere, and no prompt value survives anywhere in the DOM. Add to Cart is
now **enabled** on load on every card whose first colour is actually in stock.

#### Initial state (client decision, 2026-09-08)

**The FIRST real colour in the product option order is ringed on load** — not Shopify
`first_available`, which skips a sold-out first colour and landed the ring on swatch 2.
"Real" excludes instructional pseudo-values (see the section above). Order of preference in
`card_variant`:

1. `product.selected_variant` — only set by a `?variant=` url, so the snippet stays
   correct if it is ever rendered on a product page.
2. `first_colour_value`, the first non-prompt colour, preferring an available variant of
   that colour.
3. `selected_or_first_available_variant` — no colour option, or the first colour resolved
   to nothing.

**Everything initial derives from that one `card_variant`**: the ringed swatch (via
`selected_swatch_value`), the price, and the quick-add hidden input. `aria-product-card`
passes `variant_id: card_variant.id` to `aria-product-card-quick-add`, which is a new
**optional** param — omitted by the mega-menu and Instagram call sites, so they keep the
old `selected_or_first_available_variant` default. Ring and cart therefore cannot diverge.

**The image is NOT pre-swapped to the first colour.** On load the card shows the
Liquid-rendered product featured image; only an explicit click swaps a variant image in.
Consequence in the JS: the click handler must **not** early-return on the already-ringed
swatch, or clicking the first colour (which is ringed from the start) would never show its
own image. Every `apply*` is idempotent, so re-processing is safe.

> **Consequence to keep in mind:** where the first *real* colour is itself sold out (one
> Best Seller, whose "ALPINE CREAM - R" is out of stock while later colours are not),
> `card_variant` is unpurchasable on load, so the quick-add button ships `aria-disabled`
> (via `quick_add_disabled`, kept separate from `is_sold_out` so the SOLD OUT badge and
> `--sold-out` class stay product-level). Leaving it enabled would post a doomed
> `/cart/add` that fails invisibly behind `data-hide-errors="true"`. Ringing the first
> *in-stock* colour instead is a one-line change in the `first_colour_variant` fallback,
> but it reintroduces "why is the second swatch selected" on that card.

#### "+N more colours"

Every colour is rendered up front; the ones past `swatch_visible_limit` (5) ship with the
`hidden` attribute. The control is a `<button data-swatch-more aria-expanded>` and the JS
just sets `hidden = false` on that card's swatches, then **removes the control** so it is
never a thing that does nothing. Because the markup already exists in option order and is
never re-rendered, duplicates and reordering are impossible by construction — verified:
same DOM nodes, same order, 13/13 visible.

Expanding changes nothing else — not the ring, the variant, the image or the price — and is
scoped by `target.closest('.aria-product-card')`, so expanding product A leaves B at 5
visible with its own control intact. The control is only rendered when
`swatch_overflow_count > 0`, so a product with 5 or fewer colours never shows one.

The expanded row wraps (44px at 768px, 48px at 375px with 24px touch boxes) and grows the
card — 481→503px at 768px. That is a deliberate response to a user action, unlike the image
swap, which measures **0px** of movement.

#### Image swap

`data-variant-image` plus `data-variant-image-srcset` (228/320/456/500w, matching the
Liquid-rendered `sizes`) are inlined on each swatch, so a swap costs **no** extra request
beyond the image bytes. Never fetch `/products/x.js` for this. The new image is decoded in
a detached `new Image()` and only then assigned, so the card cannot paint a blank or
half-drawn frame; on a load error the current image simply stays. `imageToken` discards a
slow load that would otherwise land after a later click.

A variant **without** its own image falls back to the product featured image captured in
`defaultImage` (and clears the `--variant-image` class). Both directions are verified.
`.aria-product-card--variant-image` suppresses the product-level hover image while a
specific colour is showing — it would otherwise hover-flip to a different colour.

No layout shift is possible: the `<img>` is `position: absolute; inset: 0` inside a media
box with a fixed `aspect-ratio`. Measured card height held at 574px across every swap.

#### Colour-name tooltip

A 15px disc cannot tell you it is `CRUSHED ALMOND BLONDE - R`, so the name is shown on
**hover, keyboard focus, and selection**. One `.aria-product-card__swatch-tooltip` span per
card, created on first use by `getTooltip()` and parented to that card's swatch row — never
a shared document-level node, which would leak one card's colour name onto another.

**It is anchored to the swatch ROW, not the swatch, and JS clamps its left offset to the
row's width.** Anchoring it to the swatch is the obvious approach and the wrong one: a pill
centred on a 22px button overhangs the card by ~40px on the first swatch, and the card sits
flush against the swiper's `overflow: hidden` — the identical clipping the selected ring had
to be redesigned to avoid. Position comes from `swatch.offsetLeft/offsetTop` (the row is the
`offsetParent`), so a wrapped second line of swatches is handled with no special case: the
tooltip sits 6px above whichever line the swatch is on. Verified at 202px with 13 colours on
two lines.

Absolutely positioned and `pointer-events: none`, so it adds nothing to the row, shifts
nothing, and cannot interfere with the swatches or Swiper's drag. It overlays the product
title above it — inside the card, therefore safe. `aria-hidden="true"`, because each swatch
already carries `aria-label="Color: <name>"` and announcing both would be duplication.

Hover and focus hide on their real exit events (`mouseout` / `focusout`, with `mouseout`
deferring to a swatch that still has keyboard focus). A **click** additionally starts a
2.5s auto-hide timer, because a tap fires `mouseover` with no reliable `mouseout` and a
click leaves the pointer parked on the swatch.

> **Testing note — a hidden browser pane lies to you about all of this.** With
> `document.visibilityState === 'hidden'` the animation timeline is frozen, so the tooltip's
> `opacity` CSSTransition sits at `currentTime: 0` forever and pins the *start* value: the
> element reads `opacity: 0` even with `style.setProperty('opacity','1','important')`, which
> looks exactly like a cascade bug and is not one. `focusin`/`focusout` are not dispatched at
> all in that state either, though `.focus()` still moves `activeElement`. To test this
> component headlessly: inject `* { transition: none !important }` before measuring opacity,
> and dispatch `new FocusEvent('focusin', {bubbles: true})` rather than calling `.focus()`.

#### The clipped first swatch — root cause and fix

`.aria-best-sellers__swiper` is `overflow: hidden` and its left edge sits at **exactly**
the same x as the first slide, the card, the title and the swatch row (all x=40 at 1440).
So an `outline`/`box-shadow` painted **around** a 15px swatch reached ~3px past that clip
boundary and was cropped: on the first swatch always, and on the last one whenever a card
ended at the container edge. It was also invisible to begin with —
`outline: 0px solid var(--py)`, zero width.

**The ring is now drawn inside the swatch box.** The button is a 22px transparent ring
gutter, the visible 15px disc is a `::before` at `inset: 3.5px`, and the selected state is
`box-shadow: inset 0 0 0 1.5px var(--py)`. Nothing can reach outside the card at any
breakpoint, so no ancestor needs `overflow: visible` and no `!important` is involved.
Keyboard focus uses `outline-offset: -2px` for the same reason.

Consequences to know about:

- `gap` on `.aria-product-card__swatches` is **0** — the 3.5px gutter on each side of every
  disc supplies the spacing. Pitch is therefore 22px against V4 19px: the deliberate cost
  of having a ring at all (see section 10).
- The disc fill travels as a custom property, **`--aria-swatch-background`**, because a
  pseudo-element cannot read `background-*` set inline on its host. It holds either
  `rgb(...)` or `url(...)`, which is why the CSS uses the `background` shorthand.
- Touch devices get a 24px box (`@media (pointer: coarse)`), replacing an
  `::after { inset: -6px }` overlay that would now make neighbouring hit zones overlap.

Verified at **1440 / 1280 / 1024 / 768 / 390 / 375**: uniform box and pitch, zero swatch
overhang past the card *or* past the swiper clip box, no page overflow. To re-check,
**measure, do not eyeball**: compare each swatch `getBoundingClientRect()` against its card
and against `.swiper`, and confirm `document.elementFromPoint` at the swatch centre returns
the swatch.

---

### 6b. Wishlist drawer (2026-09-09)

`assets/aria-wishlist.js` grew from a localStorage toggle into the whole feature: storage,
the drawer, add-to-cart and the single-audio-style handover to the cart. Markup is
`snippets/aria-wishlist-drawer.liquid` (rendered once from `theme.liquid`), styling is
`assets/component-aria-wishlist-drawer.css`.

**Storage schema changed.** It used to be an array of bare product-id STRINGS. It is now an
array of objects keyed by **variant**, carrying everything a row needs to draw itself:
`{id, variantId, handle, title, url, image, vendor, variantTitle, price, comparePrice,
available}`. Keying by variant is deliberate — two colours of one wig are two rows, and
`/cart/add.js` needs a variant id anyway. `normalise()` runs on every read, so corrupt
JSON, nulls, numbers, duplicates and missing titles can never reach the render path.

> **Legacy entries are dropped, by necessity.** A bare product-id string carries no title,
> image, price or variant and there is nothing to hydrate it from client-side — no
> storefront endpoint takes a product id. It cannot be drawn or added to a cart, so
> `normalise()` discards it and the visitor re-hearts the product.

**Everything is captured from the card's LIVE state, not the Liquid snapshot.** The data
attributes on the heart are only a fallback; `entryFromButton()` prefers the quick-add
input's variant id, the primary `<img>`, the price row and the selected swatch, so hearting
after picking a colour stores that colour. Availability specifically **must** come from the
selected swatch's `data-variant-available` — the button's attribute is the card's default
variant, so a sold-out colour would otherwise be stored as available and only fail later at
`/cart/add`.

**Scroll-lock ownership is shared and must be checked, not assumed.** The cart drawer, this
drawer and this store's Rebuy cart all set `body.overflow-hidden`. `close()` therefore
releases it only when no other `.active` drawer remains, and the add-to-cart handover closes
the wishlist **before** calling `renderContents`, so the cart drawer's `open()` is the last
thing to touch the lock. Closing afterwards silently unlocked the page behind an open cart
drawer.

**Add to cart reuses product-form.js's exact path** — POST `/cart/add.js` with the cart
element's `getSectionsToRender()`, then `cart.renderContents(response)` — so the cart
drawer, its sections and its count bubble are untouched. The item is removed from the
wishlist **only after a 2xx**; a 422 (sold out) keeps the row and shows Shopify's own
message inline. An in-flight guard means three rapid clicks fire exactly one request.

**Opening the drawer is markup-driven, from anywhere.** There is ONE drawer instance
(rendered once from `theme.liquid`) and ONE delegated document listener, so a trigger works
wherever it appears — header, product card, product page, a section rendered after load —
with no extra JS and no reload:

```
data-wishlist-open    view trigger: opens the drawer, never mutates the wishlist
data-wishlist-count   badge: kept in sync, hidden at zero
data-wishlist-toggle  add/remove trigger (the product-card heart)
```

Everything funnels through one `openWishlistDrawer()` — `render(read())` then `open()` — so
"latest state, then show" is never reimplemented. Reachable four ways, all the same
function: a `[data-wishlist-open]` click, `document.dispatchEvent(new CustomEvent('wishlist:open'))`,
`window.openWishlistDrawer()`, `window.AriaWishlist.open()`.

**View intent is checked BEFORE add intent** in the click handler. A view trigger nested
inside (or sharing an element with) a heart would otherwise fall through to the toggle and
silently remove the product the shopper wanted to look at.

The header ships the one view trigger today — a `<button>`, not a link, since there is no
wishlist page to fall back to — reusing `.aria-header__icon-btn` and the cart bubble's badge
styling. `open()` early-returns when already active, so several triggers clicked in
succession produce exactly one activation.

**The header icon row is Wishlist → Account → Cart** (2026-09-09). Account and Cart keep
their approved relative order; the wishlist leads because it is the theme's own control and
the two Shopify ones stay adjacent.

Its glyph is `heart-outline`, NOT `heart`. `heart` is the product card's icon: a solid glyph
on a non-square 15x13 viewBox with a hardcoded `fill="white"`, drawn to sit on a translucent
pill over a photo. In the header it rendered as a different shape family, ignored `color`
entirely (white on the pale pink button, so it barely read) and sat at a different optical
height. `heart-outline` follows the recipe the header's own icons use — square `0 0 16 16`,
`fill="none"`, `stroke="currentColor"`, `stroke-width="1.3"` — which puts its rendered stroke
at 1.3px, identical to `account` and within 0.07px of `cart` (whose 25x26 viewBox scales its
`stroke-width="2"` down to 1.231px). **The rule for any new header icon: square 16 viewBox,
stroke-width 1.3, currentColor.** Anything else lands at the wrong weight or the wrong colour.

Two more defects came from the same source — `.aria-header__icon-btn` was authored for
`<a>` (cart) and `<shopify-account>`, neither of which carries UA button defaults, so it
never declared the properties a `<button>` needs:

- **The box around the heart was the UA button border**, `border: 2px outset rgb(0,0,0)`,
  together with `padding: 1px 6px`, `appearance: auto` and `font: 13.3px Arial` — the last
  of which leaked Arial into the count badge. The resets (`padding: 0; border: 0;
  font: inherit; appearance: none; cursor: pointer`) belong on the **shared class**, not on
  `.aria-header__wishlist`: that makes the class element-agnostic so any future `<button>`
  in this row is correct by default, and it is a no-op for the two existing icons, whose
  computed values there were already 0 / 0 / none / inherited. All three now compute
  identically on every box property.
- **The count badge was invisible.** `.aria-header__cart-bubble` used
  `background: var(--white)` on a button whose own background is
  `rgba(var(--it-rgb), 0.08)` = rgb(251,245,245) over the white header — about **1.03:1**.
  It read as a missing count rather than a white one. It was also 10px across with an 8px
  digit and sat at top/right 9px (5px desktop), i.e. on top of the artwork. This was a
  latent bug on the **cart** too; it had simply never been seen with a non-empty cart.
  Now `rgb(var(--color-button))` (166,74,76, an existing token) with white text at
  **5.67:1**. **Sizing rule: 12px tall pinned to the corner is what keeps it off the
  glyph** — the painted artwork starts 12px down from the button edge on desktop and 16px
  on mobile, so a 12px badge ends exactly where the icon begins. Horizontal `padding`
  grows a two-digit count leftwards into empty space rather than downwards into the icon.

Two header layout bugs surfaced while matching it, both pre-existing:

- **Shopify injects an empty `<shopify-store>`** next to `<shopify-account>` at runtime. It
  is 0x0 with no children and no shadow root — pure context metadata — but as a flex child of
  `.aria-header__nav-right` it still consumed a gap on each side, so the pair it sat between
  measured 16px apart while every other pair was 8px. `position: absolute` takes it out of
  flow without hiding or removing it.
- **The logo overlapped the icon row below 390px.** A flex item's automatic minimum size is
  its min-content width, which here was the wordmark's fixed 110px, so the logo could not
  give way and simply rendered underneath the icons. `min-width: 0` on `.aria-header__logo`
  plus `max-width: 100%` on the image lets flex resolve the row. Desktop is untouched: from
  750px up the logo is `flex-shrink: 0`. The trade-off is that at 320px the wordmark shrinks
  to ~16px — the row genuinely holds too much for that width (hamburger + logo + search +
  3 icons), and the header search pill cannot be dropped because it is the ONLY search entry
  point on mobile (`aria-mobile-nav.liquid` has no search field).

**Three bugs found after the first pass, all CSS-origin rather than state-origin:**

1. **The empty state showed alongside products.** JS was setting `.hidden = true` correctly
   the whole time; `.aria-wl-drawer__empty { display: flex }` is an AUTHOR rule and the UA's
   `[hidden] { display: none }` lives in the user-agent origin, so the author rule won. Fixed
   with a scoped `.aria-wl-drawer [hidden] { display: none }` at (0,2,0), which covers every
   element this component toggles rather than just the one that broke. **Assert computed
   `display`, never the `.hidden` property** — the property test passed while the UI was wrong.
2. **The close animation never played.** `.aria-wl-drawer` had no `transition` on
   `visibility`, so removing `.active` flipped it to `hidden` in the same frame and the
   0.3s slide-out/fade-out was never rendered. Dawn avoids this with
   `transition: visibility` on `.drawer`; the wishlist now does the same.
3. **The backdrop did not exist.** It is an empty `<div>`, and base.css's
   `a:empty, ul:empty, div:empty … { display: none }` cleanup rule hid it — no dim, no blur,
   no clickable area. `div:empty` is (0,1,1) so it beats a lone class whatever the order;
   overridden at (0,2,0). This is the same `:empty` trap the Best Sellers progress bars hit.
   **A backdrop-click test that calls `el.click()` will pass on a 0×0 overlay** — hit-test
   with `elementFromPoint` instead.

`open()` uses a forced reflow (`void drawer.offsetWidth`) rather than Dawn's zero-delay
`setTimeout` to flush the pre-transition state, so it is synchronous and there is no timer
anywhere in the file.

Deliberately NOT reusing the `.drawer` classes from `component-cart-drawer.css`: that file
only loads when `settings.cart_type == 'drawer'`, so borrowing its class names would make
the wishlist lose all styling the day the cart becomes a notification or page. The behaviour
contract (`.active`, overlay click, Escape, `overflow-hidden`, Dawn's trapFocus) is reused;
the CSS is its own.

---

### Liquid gotchas that break the build or the markup

1. **Never put a Liquid comment inside an HTML tag's attribute list.** A
   whitespace-trimming comment tag eats the adjacent newline and **welds two attributes
   into one name** — `data-aria-product-carousel` + `data-slides-mobile` became
   `data-aria-product-carouseldata-slides-mobile`, which silently stopped Swiper from
   initialising on Best Sellers with no error anywhere. Put the comment above the tag.
2. **Don't write literal Liquid tag delimiters inside a `{% comment %}` block.** Liquid
   still tokenises the body, so an example containing `{%-` raises
   *"'comment' tag was never closed"* and fails the upload.
3. **`link_list` settings only accept a fixed set of `default` handles** (`main-menu`,
   `footer`). A custom handle such as `navigation` is rejected with
   *"Invalid schema: setting with id=... default is invalid"* and blocks the whole upload.
   Omit the `default` and set the menu in the section group JSON instead.
4. **Trailing commas in a `{% schema %}` block are invalid JSON** and break that section's
   Theme Editor panel while the storefront still renders. `hero.liquid` shipped with one
   (`"label": "Logo Image",`) — validate every schema by parsing it, not by eyeballing the page.
5. **`loading="lazy"` on above-the-fold images can prevent them loading at all.** The
   header store badges combined `lazy` with a CSS chain that collapsed them to `0px`, so
   the lazy observer had a zero-area target and never fetched them. Anything in the
   announcement bar, nav or hero must be `eager`.
6. **`setting | default: 'some.key' | t` does NOT work.** Liquid applies filters left to
   right, so `default:` returns the merchant's own (non-blank) string and `t` then treats
   that English text as a translation key. The Join the Party field rendered
   `placeholder="Translation missing: en.Enter your email address"`. Translate the
   fallback on its own first, then use it as the default:

   ```liquid
   assign placeholder_text = section.settings.placeholder
   if placeholder_text == blank
     assign placeholder_text = 'newsletter.label' | t
   endif
   ```

   > **Verification lesson:** this shipped because the check scanned
   > `document.body.innerText` for "Translation missing", and **attribute values are not
   > in innerText**. Always sweep `placeholder`, `aria-label`, `title` and `alt`
   > separately when checking for missing translations.

### `external_video_tag` does not work on a `video_url` setting

`{{ section.settings.video_url | external_video_tag }}` raises
**`Liquid error: external_video_tag does not support VideoUrlDrop`** and renders the error
text into the page. The filter only accepts a **product `media` object** — which is why
`snippets/product-media.liquid` and `product-thumbnail.liquid` use it correctly, and why
the section-setting version was wrong.

Build the iframe by hand from `video_url.type` and `video_url.id`, exactly as Dawn's own
`sections/video.liquid` does:

```liquid
{%- if section.settings.video_url.type == 'youtube' -%}
  <iframe src="https://www.youtube.com/embed/{{ video_id }}?enablejsapi=1&playsinline=1&loop=1&playlist={{ video_id }}" …></iframe>
{%- else -%}
  <iframe src="https://player.vimeo.com/video/{{ video_id }}?loop=1&playsinline=1" …></iframe>
{%- endif -%}
```

Also set `border: 0` on the iframe (browsers default to a 2px inset border).

> This was **latent in `meet-the-icons.liquid` and `real-customers.liquid`** — both shipped
> the broken call, and neither had ever been exercised because no merchant had set an
> external URL. Both are now fixed. The bug is invisible until someone fills that field,
> so **test the `video_url` branch, not just the image branch**, on any section offering it.

### Shared scripts and stylesheets must be included ONCE, from `layout/theme.liquid`

Per-section `<script>`/`stylesheet_tag` includes are **not** de-duplicated by Shopify. Two
real bugs came from that, both silent:

1. **`aria-wishlist.js` was included by two sections**, so its IIFE ran twice and attached
   **two** document click listeners. One click ran both: the first pushed the product id,
   the second re-read storage, found it, and spliced it back out. The wishlist therefore
   always saved `[]` and `aria-pressed` never flipped. **Any script that attaches a
   delegated document listener must load once from `theme.liquid` and carry an
   idempotency guard** (`if (window.__x) return; window.__x = true;`).
2. **`aria-product-card.js` was included by only one section**, so New & Trending's colour
   swatches were completely inert — no image swap, no variant repoint.

Both now load once from `theme.liquid` and both carry guards.

### `vendor-swiper-bundle.min.css` must load once, in the `<head>`

Swiper's `.swiper-slide { width: 100% }` has the **same specificity (0,1,0)** as a
section's own `.aria-<section>__slide { width: 343px }`, so the winner is decided purely by
source order. With each section emitting its own copy, a Swiper stylesheet belonging to a
*later* section landed after an *earlier* section's CSS and silently reset that section's
slide widths to 100%.

That is exactly what broke the Real Customers carousel: every slide became full container
width (1345px) and the scale ladder collapsed. Loading it in the head guarantees it always
precedes section CSS. **Never re-add this stylesheet to an individual section.**

`vendor-swiper-bundle.min.js` and `aria-product-carousel.js` are now hoisted to
`theme.liquid` too — five sections were each emitting the vendor bundle, so the UMD
re-executed five times per page. Deferred scripts run in document order, so loading them
in the head guarantees `Swiper` is defined before any section-scoped consumer
(`aria-real-customers.js`) runs.

### Swiper can initialise before it can measure — and does not recover on its own

If the container has **zero width** at init (a collapsed ancestor, a section the theme
editor is still laying out, a hidden/background tab), Swiper:

- registers **zero slides** (`swiper.slides.length === 0`),
- resolves `currentBreakpoint` as **`'max'`** so every `breakpoints` entry is ignored,
- falls back to the base (mobile) `slidesPerView`,
- and renders **every slide at the container's full width**.

A `window.resize` event does **not** fix it. Only an explicit `swiper.update()` does.
`assets/aria-product-carousel.js` now guards this in `ensureMeasured()`: after init it
re-runs `update()` on `window.load` and via a `ResizeObserver`, disconnecting as soon as
slides are registered. Symptom to recognise: a carousel showing exactly one full-width
slide with the mobile `slidesPerView` at desktop.

### Fixed-width flex/grid children must be allowed to shrink

Four separate bugs, all the same shape: a desktop rule pinned children at their V4 pixel
width with `flex: 0 0` or a bare fixed grid track, so between 990px and ~1300px the row
was wider than its container. Use `flex: 0 1 <V4 width>` + `min-width: 0`, or
`minmax(0, <V4 width>)` for grid tracks — both hold V4's exact size wherever there is
surplus (1440 always has it) and give way below that.

| Section | Symptom | Fix |
|---|---|---|
| Trust badges | `repeat(4, 255px)` + 70px gap needs 1230px; **111px of page scroll at 1024** | `repeat(4, minmax(0, 255px))` |
| Join the Party | panel 40+471+64+529+40 = 1146px inside an 895px box — clipped on both sides by the section's `overflow: hidden`, so it read as cut off rather than overflowing | copy/collage to `flex: 0 1`, panel `max-width: 100%` |
| Community Exclusive | media `flex: 0 0 630px` starved the panel to ~195px; the 48px price + 28px compare needed 291px and ran out of the section (**16px of page scroll at 1024**) | media `flex: 0 1 630px`, price row `flex-wrap: wrap` |

> **Auditing note:** page-level overflow is not the only failure mode. A section with
> `overflow: hidden` swallows its own overflow, so an oversized child is clipped silently
> and never shows up in a `scrollWidth` check. Compare each fixed-width child's box
> against its container's box as well.

### `flex-shrink` can squash a tap target below its declared size

`.aria-header__menu-toggle` is declared 44x44 but rendered **30px wide at 375px**: the nav
row needs 44 + 12 + 152 = 208px and only has 171, and the button was the only shrinkable
item. It now carries `flex: none`, and the logo steps down to 110px below 750px so the row
fits (`flex-shrink: 0` existed only in the >=768 block, which is why this survived so long).
Measuring the computed `width` would have missed it — only the rendered rect showed 30px.

### Predictive search dropdown — Dawn's two-column layout does not fit a header

Dawn lays predictive results out as **two side-by-side columns** from 750px up, with the
suggestions column pinned at `flex: 0 0 26.4rem` (264px) and products taking the rest.
A header dropdown never has the ~550px+ that needs.

The original override forced `width: 100%` onto both `__results-groups-wrapper` and each
`__result-group` and added `overflow: hidden`. In a flex row that makes each column demand
the full panel width, so the **Products column was squeezed to ~26px and clipped away** —
only query suggestions were visible — while the squeezed product rows still forced the
panel hundreds of pixels tall. That is what produced the tall panel, the big empty area
and the scrollbar. The API was returning products the whole time (verified by fetching
`/search/suggest?q=…&section_id=predictive-search` directly: 8 queries + 2 products).

Current treatment (`.aria-header__search-results` in `section-aria-header.css`):

- Columns **stacked** (`flex-direction: column`); `:first-child`/`:only-child` selectors
  are needed to out-specify Dawn's 750px+ column sizing.
- **Products ordered first** (`:nth-child(2) { order: -1 }`) — Dawn's DOM order puts 8
  query suggestions above them, pushing the thumbnail/price rows below the scroll fold.
- Suggestions **capped at 5** with `li:nth-child(n + 6) { display: none }`. Safe for
  keyboard nav: Dawn selects candidates with `offsetParent !== null`
  (`assets/predictive-search.js`), so hidden rows are skipped, not invisible focus traps.
- `max-height: min(72vh, 520px)` — the trimmed set is ~500px, so no scrollbar appears at
  normal viewport heights; the thin brand-tinted scrollbar only shows on short screens.
- 48px product thumbnails, and `predictive_search_show_price` switched **on** in
  `settings_data.json` (prices drive the click on a wig store).
- Dawn bolds the UNMATCHED half of a suggestion and lightens the match, which reads
  backwards ("am" faint, "sterdam" bold). Inverted so the matched characters are the
  emphasised, `--qi`-coloured ones.

> **Do not re-add `width: 100%` to `__results-groups-wrapper` or `__result-group`** — that
> is what clipped the products.

### Reused Dawn behaviour (do not reimplement)

- **Cart drawer:** an element with `id="cart-icon-bubble"` is auto-bound by Dawn's
  `cart-drawer.js`. `<cart-drawer>` is rendered globally in `theme.liquid`
  (requires `settings.cart_type == 'drawer'`).
- **Cart count:** `sections/cart-icon-bubble.liquid` is re-fetched by Dawn's Section
  Rendering API after every cart mutation. It and the header both render the shared
  `snippets/aria-cart-icon-bubble-content.liquid` so the icon never flickers.
- **Add to cart:** `<product-form>` (Dawn's `product-form.js`) — handles the fetch,
  cart-drawer open, and bubble refresh.
- **Search:** `<predictive-search>` / `<search-form>` custom elements from Dawn.
- **Account:** `<shopify-account>` web component, gated on `shop.customer_accounts_enabled`.
  This theme only supports *new* customer accounts (no classic fallback exists in Dawn here).

---

## 7. Reusable Snippets

| Snippet | Purpose |
|---|---|
| `aria-product-card.liquid` | Full product card — image + hover image, wishlist, badges, rating, swatches, price, View Product, quick-add. Params: `product`, `feature_tag_metafield`, `section_id`. **One design, no variants** — the `card_style`/`compact` param was removed; both Best Sellers and New & Trending render this exact card. Each swatch carries its resolved variant id / image / price / availability as data attributes — see §6a. |
| `aria-product-card-quick-add.liquid` | The `<product-form>` quick-add control. Params: `product`, `section_id`, `is_sold_out` (drives `aria-disabled` only), `icon`, `variant_id`. `variant_id` pins the variant the form starts on — `aria-product-card` passes its ringed colour's variant; other call sites omit it and keep the `selected_or_first_available_variant` default. |
| `aria-icon.liquid` | Inline SVG icon dispatcher. `{% render 'aria-icon', name: 'search' %}`. Icons: search, account, cart, heart, heart-filled, star, star-outline, chevron-down, arrow-left, arrow-right, close, menu. |
| `aria-cart-icon-bubble-content.liquid` | Shared cart icon + count bubble markup. |

---

## 8. Shopify Schema Conventions

- Setting `id`s are **snake_case**.
- All `label` / `name` / `info` values are **translation keys**
  (`t:sections.<key>.settings.<id>.label`) resolved in `locales/en.default.schema.json`.
  Dawn never hardcodes schema strings — match that.
- Merchant-facing labels must be plain English ("Heading"), never developer names
  (`h2_text_1`).
- Every section ships a `presets` entry with sensible defaults.
- Repeating UI uses **blocks** with sensible `max_blocks`.
- Non-merchant UI microcopy lives in `locales/en.default.json` under the `aria_theme.*`
  namespace and is rendered with the `t` filter.

### Dynamic vs. static content rules

**Must be dynamic / merchant-controlled:**
products, collections, prices (always via the `money` filter), product images, badges,
ratings, variants/swatches, navigation menus, all visible copy, all links, all images.

**May be hardcoded:** system states (`Sold out`), a11y labels, decorative SVG icons,
structural CSS.

### Product metafields

| Metafield | Type | Use |
|---|---|---|
| `custom.feature_tags` | `list.single_line_text_field` | Product card badges ("Best Seller", "New Arrival"). Namespace/key is a **section setting**, so it can be repointed without code changes. Empty ⇒ no badge container. |
| `reviews.rating` / `reviews.rating_count` | Shopify standard | Star rating. **No rating ⇒ unfilled stars.** Never fabricate review data. |

---

## 9. Section Implementation Notes

### Best Sellers — light (V4, `1:448`)
Restyle of the existing dark section. Product logic is **unchanged**.
- Background: vertical gradient `#FFFFFF → #F5EBE2` (was flat dark `#161616`).
- Product card becomes **transparent, unpadded**, width `331px`, gap `20px`.
- Carousel row gap `12px` → 4 × 331 + 3 × 12 = **1360px**, exactly the container.
- "View Product": black outline, 18px/28px weight 400, radius 2px, padding 12/24.
- Rating pill: `#FAF8F5` fill, `#BC696B` border.
- Text: `#2B2C2B` body, `#3F3E3E` product title.
- **Swatches are a working variant picker** (image + selected variant + Add to Cart)
  and the selected ring is drawn inside each swatch box — read section 6a before
  touching either.

### Meet the Icons
**No Figma frame exists in V4.** Confirmed with the client: it is an *Icons Collection*
feature section, to be built with **placeholder images and video** for now, styled to
match the established V4 language. Revisit when a frame is supplied.

### Start Here (`1:493` top) — BUILT
`sections/start-here.liquid` + `assets/section-aria-start-here.css`.
Gradient `#F5EBE2 → #FFFFFF` (stop 55.171%). Header is heading-left / description-right at
desktop, stacked on mobile. Cards: white, `radius 10px`, `p 16px`, 120px icon.
**Grid: 2 cols mobile (explicit requirement) → 3 at ≥750 → 6 at ≥990.**
Six line-art icons exported from Figma to `assets/wp-icon-*.svg`; each block can override
with an `image_picker`, or pick a built-in via a `select`.

#### Card hover (2026-09-08)

Lift + elevation on hover: `translateY(-4px)`, a two-layer brand-rose shadow, and
`scale(1.03)` on the icon, over 200ms `cubic-bezier(0.22, 0.61, 0.36, 1)`. Four things
about it are load-bearing:

1. **The old rule was `a.aria-start-here__card:hover`, and it never fired.** A block only
   renders as an `<a>` when the merchant fills in its `link` setting, and none of the six
   homepage blocks has one — all six are `<div>`s. That is why the section appeared to have
   no hover at all. The selectors now match the card class regardless of tag, so all six
   behave identically whether or not a link is set.
2. **Hover rules are scoped `.aria-start-here .aria-start-here__card`.** The class is
   already unique to this section and stylesheet — the mega menu uses `aria-mega-*` /
   `aria-header-*` and shares nothing — but the ancestor makes it impossible for these
   rules to reach the header even if a name is reused later. Verified by auditing all 36
   selectors in the stylesheet against the live DOM: every one matches only inside
   `.aria-start-here`, with zero matches in the header or among the 543 mega-menu elements.
   **Note the name collision trap:** the Start Here *mega menu panel* is
   `.aria-mega--start-here`, which is a different thing from the `.aria-start-here` section.
3. **The icon WRAPPER is scaled, never the `<img>`.** `.aria-start-here__icon` carries
   `overflow: hidden`, so scaling the image inside it shaves the artwork edges; scaling the
   wrapper moves its clip box along with its contents and cannot clip anything.
4. **`position: relative; z-index: 1` on hover is what makes the shadow visible.** The
   cards are siblings in source order, so without it the next card's white background
   paints over the shadow spilling right. Neither property moves anything.

`@media (hover: hover) and (pointer: fine)` keeps the lift off touch, where `:hover` latches
after a tap. The pre-existing border tint and 2px nudge stay outside that query so touch
behaviour is unchanged. `prefers-reduced-motion` drops the movement and keeps the elevation.

Verified: all six cards identical (-4px, 1.03, both shadow layers, rose border, z-index 1),
zero width/height change, no icon clipping, no horizontal overflow, no sibling movement, and
the section height unchanged. At 375px the hover query is `false` and the grid, card padding,
radius, border and 88px icon are untouched.

### Meet the Icons (`1:588`, inside frame `1:493`) — BUILT
**The Figma frame does exist** — it is the lower half of the Start Here frame, not a
missing section. Built as its own Shopify section so merchants can reorder it
independently: `sections/meet-the-icons.liquid` + `assets/section-aria-meet-the-icons.css`.
- **Panel spacing is a nested ladder, not a single flex `gap`:** 15px pill→heading,
  16px heading→subheading, 48px subheading→CTA (V4 `1:592`). A flat `gap: 48px` spread all
  four children evenly and was the cause of the "content spacing" complaint. Implemented as
  explicit margins on each child so no wrapper elements are needed.
- Panel: `p-40`, `left: 80px`, vertically centred, `rgba(255,255,255,0.13)` +
  `backdrop-filter: blur(57.25px)`, 1px white border. Eyebrow pill `#a64a4c` on a
  `#bc696b` border, Poppins Medium 14/22 uppercase. Heading Montserrat Medium 48/56.
  Subheading Poppins Medium 16/26 uppercase `#a64a4c`. CTA full-width, `px-24 py-12`, radius 2.
- Media layer supports an uploaded **video**, an **external video URL** (YouTube/Vimeo),
  or a still image, falling back to the exported V4 still `wp-meet-the-icons-bg.jpg`.
  This satisfies the "placeholder images and video for now" instruction.
- Frosted-glass panel: `rgba(255,255,255,0.13)` + `backdrop-filter: blur(57.25px)`,
  white 1px border, left-offset 80px at desktop.
- Decorative Kristi signature (`wp-kristi-signature.svg`) is desktop-only and
  `aria-hidden`; overridable via `image_picker`.

### Community Exclusive (`1:602`) — BUILT
Dark band (`#1A1A1A`, merchant-editable). Split feature card: 630px media with a
`#B94E50` "Flash Discount" badge + white detail panel (`#F6EDE5` media backdrop).
**Product-driven:** an optional `product` picker supplies title, image, price,
compare-at price and link via real Shopify objects; text settings override each field so
a merchant can also run a non-product deal (a category or a flash discount) — this is why
the deal is not a pure product reference.

### Deals & Exclusives (`1:636`) — BUILT
White collection grid, 4 blocks, 2 cols mobile → 4 at ≥750px.
Card spec differs from Shop By Collection: fixed `326/370` media ratio, 20px title, 18px
gutter (vs `320/418` and 24px). Kept as a separate section rather than overloading
Shop By Collection, because merchants need it discoverable under its own name and the
card proportions genuinely differ.
*Future:* both could share an `aria-collection-card` snippet — deferred to avoid
regressing a working section.

### Deals & Exclusives (`1:636`) — View More buttons (2026-09-08)

Every collection card now carries a View More button matching
`.aria-find-wig__btn` from Find Your Perfect Wig, which was the specified reference.

**The card had to stop being an `<a>`.** It was `<a class="aria-deals__card">` wrapping the
whole card, and the reference pattern is the opposite — the card is a `<div>` and the
*button* is the link. An `<a>` inside an `<a>` is invalid and browsers un-nest it, so the
card is now a `<div>` and the View More anchor carries `block.settings.link | default:
col.url`.

**Whole-card clickability was preserved, not dropped**, via a stretched hit area:

```css
.aria-deals__card { position: relative; }
.aria-deals__btn::after { content: ''; position: absolute; inset: 0; z-index: 1; }
```

Clicking the image, the title or the button all resolve to the button (verified with
`elementFromPoint` on all four cards), and there is still exactly **one** tab stop per card
rather than two links to the same URL.

Two consequences that are easy to miss when touching this section:

- **`.aria-deals__card:focus-visible` can never fire again** — a `<div>` is not focusable.
  The image zoom that used to key off it now keys off `:focus-within`, so keyboard focus on
  the button still triggers it. Do not "restore" the old selector.
- **`margin-top: auto` on the button** is what keeps buttons on one baseline across cards
  whose titles wrap to different line counts (verified: a 2-line and a 1-line title in the
  same grid row still share a button baseline). It is copied from the reference for the
  same reason.

**The button values are restated in `section-aria-deals-exclusives.css`, not shared.** The
two sections load independent stylesheets and Find Your Perfect Wig was out of scope to
modify, so `.aria-deals__btn` mirrors `.aria-find-wig__btn` exactly — 44px min-height,
12/16 padding, 1px `var(--sy)` border, 2px radius, transparent fill, 15/24 type, the same
`var(--py)` fill on hover, and the same step-up to 12/24 and 18/28 at >=990px. Verified by
diffing computed styles at every breakpoint: **zero differences**, and both `:hover` rules
declare byte-identical values. If these ever need to move together, lift the button into a
`component-aria-*.css` loaded once from `theme.liquid` (the pattern the product card and
video controls already use) and point both sections at it.

A section-level `button_label` setting (default "View More") mirrors the reference's
configurable label; blank hides the buttons.

### New and trending (`1:674`) — BUILT
Gradient `#FFFFFF → #EADDD4`. Swiper carousel, **5 × 262px slides + 4 × 12px gaps** at
desktop. The section owns its heading, spacing, gradient and slider config; it does **not**
own a card design.

> **The `--compact` card variant was REMOVED (2026-09-08, client request).** This section
> used to pass `card_style: 'compact'` to `aria-product-card.liquid`, which swapped in a
> `262/320` media ratio, a chip badge inside the image, an in-image quick-add and no View
> Product button. The client asked for New & Trending cards to be visually identical to
> Best Sellers, so the section now renders the same default card with **no `card_style`
> argument at all**, and the variant was deleted rather than left to drift:
>
> - `snippets/aria-product-card.liquid` — `card_style` / `is_compact` and all four of their
>   branches are gone. Every branch was false for the default card, so Best Sellers renders
>   byte-identically (re-measured: 327×574 card, 327×316 media, ratio 1.0344 — unchanged).
> - `assets/component-aria-product-card.css` — the 65-line `.aria-product-card--compact`
>   block is gone, and `.aria-product-card:not(.aria-product-card--compact) … .price` lost
>   its now-meaningless qualifier.
> - `sections/new-trending.liquid` — the render call and the empty-state div no longer
>   mention compact.
>
> **What the deleted variant contained**, in case it is ever wanted back (there is no git
> history here): card `gap: 12px`; media `aspect-ratio: 262/320`; body `gap: 12px`;
> `__swatch-more` at `12px/14px uppercase`; price `margin: 18px 0 15px`; actions
> `position: absolute; right: 8px; bottom: 8px; z-index: 2; gap: 0`; cart button
> `31×31`, `border-radius: 120px`, no border, white background; and a ≥750px block giving
> the quick-add `width: auto; opacity: 0` → `opacity: 1` on card hover/focus-within.

**There is now exactly one card design.** A change to `aria-product-card.liquid`,
`component-aria-product-card.css` or `aria-product-card.js` lands in both sections by
construction — which is the point. Do not reintroduce a per-section card modifier.

**Card width legitimately differs between the two sections** and that is not a bug: the
card is fluid (`width: 100%`) and New & Trending runs a 5-up slider against Best Sellers'
4-up, so at 1440 the cards are 259px vs 327px at the same `331/320` media ratio. Every
other card property is identical — verified by diffing computed styles for both sections
and getting an empty difference list.

### Real Customers, Real Confidence (`1:683`) — BUILT
Black band. Swiper carousel with a **scale ladder**: active `1.00`, immediate neighbours
`0.84`, the rest `0.70` — reproducing V4's 343 / 289 / 239 tiers. Slides overlap via
`spaceBetween: -111` at desktop (derived from Figma: adjacent slide centres sit 231.8px
apart, and `231.8 − 343 = −111`).

Each block is a story with an image poster plus an optional uploaded **video** or
**external video URL**.

**Every slide shows the poster + play button, and the button really plays.** When a video
is set the media becomes Dawn's `<deferred-media>`: the poster is a real
`<button id="Deferred-Poster-{{ block.id }}">`, the video/iframe lives in a `<template>`
and is only fetched on click, and the poster hides once `loaded` is set. With no video the
glyph stays decorative and `aria-hidden`.

> This was originally an `if/elsif` chain where an uploaded video **replaced** the image
> and rendered as a bare `<video controls>`, so V4's poster-with-play-button treatment only
> ever appeared on image-only slides — where the button did nothing. The image is now the
> poster and the video sits behind it. An uploaded video's own `preview_image` stands in
> when no image is set, so a video slide is never a blank box.
>
> `.aria-real-customers__play` must keep `pointer-events: none` or the glyph swallows the
> click meant for the poster button beneath it. And the injected iframe needs
> `border: 0` — the UA default 2px border otherwise makes the video 4px wider than its
> frame (it no longer inherits the old `__video-external` wrapper's reset).

Three deliberate decisions, each the result of a real failure:
1. **Not Swiper's `coverflow` effect.** Its 3D depth crushed neighbours asymmetrically
   (229 / 22 instead of 289 / 239).
2. **`loop: false`.** With wide `slidesPerView:'auto'` slides, Swiper's loop clones
   reorder the DOM and the prev/active/next classes land on the wrong elements. Uses
   `initialSlide` at the midpoint instead so it opens centred.
3. **The scale is set as an inline transform from JS, not in CSS.** Two separate
   cascade problems: Swiper's own `.swiper-backface-hidden .swiper-slide { transform }`
   ties on specificity with any `.slide.swiper-slide-active` rule, and declaring
   `transform` in CSS *as well as* inline left a transition permanently in flight so the
   computed value never settled on the target. CSS now owns only `transform-origin` and
   the `0.4s` easing; `aria-real-customers.js` owns `transform`.

> **Debugging note:** always let the 0.4s transition settle (or assert
> `element.getAnimations().length === 0`) before trusting `getBoundingClientRect()` on
> these slides — mid-transition reads are what made this look inconsistent for so long.

> **A hidden or backgrounded tab freezes CSS transitions**, which makes this section look
> broken when it is not. With `document.hidden === true` the compositor is throttled: the
> inline `scale()` is present in `element.style`, but the *computed* transform stays at the
> start value and `getAnimations()` never empties, so the ladder reads as 1/1/1/1/1.
> To measure it reliably, set `style.transition = 'none'` first and then read — the frames
> then resolve to the correct 240 / 288 / 343 / 288 / 240.

#### Video carousel (2026-09-08)

Every slide is an autoplaying, muted, looping, inline `<video>` with the section's own two
controls. Previously only slides with a video showed one, behind a click-to-play
`<deferred-media>` poster, and it rendered as a bare `<video controls>`.

**Autoplay: `rewind`, not `loop` — and that is measured, not assumed** (2026-09-09). The
slider auto-advances every 5s (`AUTOPLAY_DELAY` in `aria-real-customers.js`) using **Swiper's
own autoplay module**, which is the single timer: there is no `setInterval`/`setTimeout` in
that file at all. Tested on Swiper 11.2.10 against this exact geometry:

| | result |
|---|---|
| `loop: true` | **Sticks.** activeIndex advances once then stops dead at 1, `.swiper-slide-active` vanishes from the DOM at the wrap, realIndex overruns the slide count. Swiper cannot build a valid cycle from five wide `slidesPerView:'auto'` slides with a large negative `spaceBetween`. |
| `rewind: true` | `2 -> 3 -> 4 -> 0 -> 1 -> 2 ...` forever, `.swiper-slide-active` always present, activeIndex always equal to the active slide's DOM position, so the scale ladder stays exact. |

Note the **old "loop clones duplicate every `<video>`" reasoning is obsolete**: Swiper 11
reorders real slides rather than cloning (the bundle contains no `cloneNode` and never emits
`swiper-slide-duplicate`), and both modes keep exactly five slides and five videos. Loop is
ruled out because it *sticks*, not because it duplicates.

**The autoplay gate.** One function, `applyAutoplayGate()`, is the only thing in the file
that starts or stops autoplay. It reads three inputs:

- `isSectionVisible` — the one genuinely stateful input, so the only one stored, set by an
  `IntersectionObserver`.
- **mute state — read from the `<video>` elements themselves, never mirrored into a flag.**
  The mute state IS the source of truth, so nothing can disagree with the actual audio. This
  is what makes the multi-video case fall out for free: `soloAudio()` muting the previous
  video is just another `volumechange`.
- `prefers-reduced-motion` — an auto-advancing carousel is a WCAG 2.2.2 concern; prev/next
  still work, so nothing becomes unreachable.

`volumechange` **does not bubble**, so the listener is attached in the **capture** phase on
the section — capture still reaches a non-bubbling event on its way down to the target. One
listener therefore covers every video including any rendered later, with no per-video
bookkeeping to leak.

`autoplayResume` and `touchEnd` are also wired to the gate. That is what vetoes Swiper's own
`disableOnInteraction: false` auto-resume when a drag ends while a video is unmuted.

**Leaving the section mutes any unmuted video in it.** Deliberate: audio should not keep
playing from a section that has been scrolled past, and the brief requires that an unmute
must not leave autoplay permanently blocked once the viewer has gone. Muting is the honest
way to satisfy both, since the state the gate reads and the state the sound button shows stay
the same thing (the global manager resyncs the button from the resulting `volumechange`).

> **Testing note.** `IntersectionObserver` never fires while `document.hidden` is true, which
> is the case whenever the Claude browser pane is collapsed. To exercise the gate, stub
> `window.IntersectionObserver` to capture the callback, then re-run the real `init()` by
> dispatching `shopify:section:load` on the **section** (not the carousel — the handler does
> `event.target.querySelectorAll('[data-aria-rc-carousel]')`, so dispatching on the carousel
> itself matches nothing). Also note `volumechange` is asynchronous: await the event rather
> than reading state synchronously after a click, or every assertion reads one tick stale.

**Where each piece lives:** markup in `sections/real-customers.liquid`; carousel behaviour
in `assets/aria-real-customers.js` (Swiper only — no second carousel library); **video
behaviour in the shared `assets/aria-video-controls.js`, not here** (see §9a); control
appearance in the shared `assets/component-aria-video-controls.css`, with only the
`bottom`/`left`/`right` offsets left in `assets/section-aria-real-customers.css`. Four icons
(`play`, `pause`, `sound-on`, `sound-off`) were **added** to `snippets/aria-icon.liquid`;
no existing icon was changed.

**Autoplay contract.** `autoplay muted loop playsinline preload="metadata"` and **no
`controls` attribute** — that absence is what keeps every piece of native chrome (timeline,
volume, fullscreen, PiP, settings) off the slide. `muted` must be present as an *attribute*,
not merely set from JS, or Chrome and Safari refuse the autoplay; `playsinline` is what
stops iOS going fullscreen. `play()` is called through a `.catch()` that resyncs the button,
so a refusal (data saver, battery saver, a hidden tab) leaves the poster showing and the
button honestly reading "Play" instead of lying.

**Built by hand, not with `video_tag`.** `video_tag` posts the video's own preview frame and
offers no way to override it; this design wants the merchant's photo as the poster, so the
element is assembled from `rc_video.sources`.

**All slides video, without duplicating the file per block.** A new section setting,
`fallback_video`, is used by any block that has no video of its own. On this store three of
the five blocks are image-only, so the fallback is set to the same
`shopify://files/videos/placholder-video.mp4` the other two already use, and all five slides
are video. Per-block videos still win. Nothing is hardcoded — both come from settings.

**Single-audio rule.** Only one video in the section is ever audible. Unmuting one mutes the
rest, and because muting fires `volumechange`, every other button resyncs off the real media
state rather than a manual sweep. Audio survives slide navigation (verified: unmute slide 0,
travel to slide 4, slide 0 is still the audible one) and unmuting **never pauses** anything.

**Controls are in opposite corners, deliberately.** Play/pause bottom-left, sound
bottom-right, both inset 10px (12px ≥750px). Do not group them: the brief calls this out
explicitly, and measured separation is 215px at desktop and 130px at 375px. Both icons for
each state are rendered and CSS shows one per `data-state`, so a toggle is an attribute flip
rather than an `innerHTML` rewrite.

**What was deliberately removed:** the old `slideChange` handler that paused *every* video.
That is wrong here — muted neighbours are meant to stay live and the audible one keeps
playing past its slide. In its place, `slideChangeTransitionEnd` resumes the arriving
slide's video unless the viewer paused that one by hand (`__ariaRcUserPaused`), so a
deliberate pause outlives a navigation.

**Swiper `loop` stays off,** now for a second reason on top of the scale-ladder one already
documented: loop clones would duplicate every `<video>`, which is exactly the "duplicate
videos playing" failure the brief warns about.

**External video URLs keep the old behaviour.** YouTube/Vimeo remain a click-to-play
`<deferred-media>` poster with that provider's own chrome, because driving a third-party
iframe would mean loading their player APIs. Prefer Shopify-hosted files in this section.

> **Testing note:** a hidden browser pane cannot sustain video playback. `play()` resolves
> and `paused` flips briefly, then the page's suspension takes it back — so autoplay-on-load
> and sustained playback can only be confirmed in a visible window. Everything that is not
> frame decoding (mute state, the solo rule, button/label sync, geometry, the user-pause
> flag) is fully testable headlessly.

### Education & Guides (`1:776`) — BUILT
Two-column band that **deliberately bleeds full width**: V4 places the panels edge to edge
(742 + 698 = 1440), so this section does *not* use the 1360px container. The split is
expressed as `grid-template-columns: 742fr 698fr` so the ratio holds at any width.

Each block is one guide (title, link, image).

**The guide list is plain links — NOT tabs, and not a slider.** It was originally a tab
strip: the list auto-rotated, one item carried an `.is-active` white-filled step-up
treatment, and hover/focus/click selected a guide and swapped the image. The user asked for
plain links instead, so all of that is gone. Every guide is now an `<a>`, all three look
identical (V4's *unselected* treatment — outlined, uppercase, 16px — used as the resting
state for all of them), nothing carries a selected state, and nothing in the list touches
the image.

- V4's white-filled look is now the **hover/focus-visible** affordance, so the interaction
  reuses the design's own vocabulary instead of an invented one.
- **Do not transition `font-size`, and do not restore the size/case step-up on hover.**
  V4's selected state is both a size up and sentence case; changing either on hover reflows
  the label under the cursor. Background and border only.
- A guide with **no URL yet renders as a link on a `#` placeholder**, not as dead text —
  same convention as the About and Footer social links, and it keeps the row visually
  uniform while making the gap visible to the merchant. Two of the three live blocks are
  currently in this state.
- **The block type is still `"tab"`.** Renaming it would orphan the three stored blocks
  (`eg-1`/`eg-2`/`eg-3`) in `templates/index.json`. The CSS/markup classes were renamed
  `__tab*` → `__link*`, but the schema type must stay.

`aria-education-guides.js` was rewritten to rotate **only the images**, on the existing
`autoplay` / `autoplay_interval` settings (kept, so no Theme Editor settings were removed),
skipped under `prefers-reduced-motion` and with fewer than two images, and paused while
off-screen or backgrounded. It no longer references the guide list at all.

> Worth knowing: all three live blocks point at the **same** image (`image-3.jpg`), so the
> rotation is currently visually inert. It was kept rather than deleted because ripping it
> out would drop the per-block image setting and two Theme Editor controls; if the images
> should simply be static, that is a small change.

Assets: `wp-education-leaf.svg` (decorative flourish, desktop only — the section is
`overflow: hidden` so it can never cause horizontal scroll) and
`wp-education-feature.jpg` (fallback photo, re-encoded from a 1.3 MB PNG down to ~100 KB).

### Find Your Perfect Wig (`1:795`) — BUILT
Four cards, `4 × 326 + 3 × 18 = 1358` — the exact V4 content row. Two-up on mobile,
four-up from 750px.

Each card is a block: title, subtitle, image, button label and link. Two settings exist
because V4's fourth card differs from the rest:
- `background_color` per card (the cap-size card is cream `#EADDD4`).
- `image_fit` — `cover` for photos, `contain` for the cut-out product shot that must not
  be cropped.

Ships the V4 reference photos as **built-in defaults** via a `default_image` select, the
same pattern as `start-here.liquid`'s `default_icon`: an uploaded `image_picker` always
wins, but the section looks right out of the box. (`image_picker` settings only accept
`shopify://` file URLs, so a theme asset cannot be preset in `index.json` — the select is
what makes shipped defaults possible.)

Card buttons use `margin-top: auto` so they align across cards with different text
lengths; the 8px `margin-bottom` on `__text` supplies V4's 21px text→button gap while
keeping the media→text gap at 13px.

### Real Women. Real Wigs. Real Confidence. (`1:853`) — BUILT
680px featured photo + 20px gap + flexible side column = the 1360 V4 row. The testimonial
is a **frosted panel pinned to the base of the photo** — `rgba(255,255,255,0.13)` +
`backdrop-filter: blur(50px)` + 1px white border, the same treatment as Meet the Icons.

The photo strip runs past the column edge in V4. It is implemented as an
`overflow-x: auto` scroll-snap container rather than a clipped row, so the extra photos
stay reachable on touch; the section itself is `overflow: hidden` so this can never become
page-level horizontal scroll.

Blocks are the strip photos (image + optional link). The featured photo, quote,
attribution and both buttons are section settings.

### 9a. Shared video controls + the ONE global audio manager

`assets/aria-video-controls.js` owns every managed video on the page, whichever section it
belongs to: autoplay muted inline on load, the custom play/pause and mute/unmute buttons,
and the rule that **at most one video is ever audible**. `assets/component-aria-video-controls.css`
owns their appearance. Both load **once from `layout/theme.liquid`**.

**Why one manager and not one per section.** Real Customers and Why Wig Party each used to
be a candidate for its own audio logic, and two such managers could each believe their own
video held the audio — the cross-section conflict this exists to prevent. There is a single
`window.__ariaVideoControlsInit` guard and a single delegated document click listener for
the whole page, so a duplicate include or a `shopify:section:load` storm cannot double a
click or re-register a video (verified: 3 consecutive section-load events left 6 videos,
each registered once, and exactly one unmuted).

**Opting in is pure markup**, which is what makes it future-safe — a section added later
participates with no change to the script:

```
[data-aria-video]        the <video> itself
[data-aria-video-media]  its wrapper; the scope for that video's two buttons
[data-aria-video-play]   play/pause  (data-label-play  / data-label-pause)
[data-aria-video-sound]  mute/unmute (data-label-mute  / data-label-unmute)
```

Labels ride on the buttons as Liquid-translated `data-*` attributes (`aria_theme.video.*`),
so the script needs no translation global.

**The audio list is read from the DOM at click time**, not held in a registry array. A video
added or re-rendered later is included automatically and there are no stale references to
leak. `soloAudio()` only ever writes `muted` — it never pauses, reloads or re-seeks another
video, and because muting fires `volumechange`, each other button resyncs itself.

**Play/pause is per video and independent of audio.** `video.__ariaVideoUserPaused` records
a deliberate pause so Real Customers' `slideChangeTransitionEnd` hook can decline to resume
that one; nothing else reads it.

**`controls` is never emitted on a managed `<video>`.** That absence is the whole mechanism
for keeping the native timeline, volume, fullscreen and PiP chrome away. `muted` must be a
real ATTRIBUTE (not merely set from JS) or Chrome/Safari refuse the autoplay, and
`playsinline` is what stops iOS going fullscreen.

**Control positions belong to the sections, not the shared CSS** — the two media boxes are
different shapes:

| Section | Media box | Play | Sound |
|---|---|---|---|
| Real Customers | 316/546 portrait card | bottom-left | bottom-right |
| Why Wig Party | 846/474 landscape frame | bottom-left | **top-right** |

Why Wig Party's sound button is top-right on purpose: that frame's bottom-right corner is
already occupied by `.aria-why__signature` (`inset-inline-end: 2.48%`, `inset-block-end:
3.38%`, up to 158px wide), so copying Real Customers' corners would land the button on the
wordmark. Verified no overlap with the signature or with each other.

> **Why Wig Party's `video_autoplay` and `video_show_controls` settings no longer apply to a
> Shopify-hosted video** — autoplay is unconditional and the controls are the theme's own.
> `video_show_controls` still drives the external-iframe branch. `video_autoplay` is now
> effectively unused; left in place rather than deleted so no merchant data is dropped.

**External video URLs cannot join the group.** YouTube/Vimeo stay a click-to-play
`<deferred-media>` poster with that provider's chrome, because driving a third-party iframe
needs its player API. Prefer Shopify-hosted files in both sections.

---

### Why Wig Party (`1:880` wrapper / `1:881` heading) — BUILT
`sections/why-wig-party.liquid` + `assets/section-aria-why-wig-party.css`.
Flat `#F5EBE2` band, centred heading, then an 872px column holding a white-matted media
frame and a 3-up feature row. Verified against the live preview at 320/375/768/1024/1440:
media **846×474** (ratio 1.7848 vs V4's 1.78481), column 872, play glyph 70×70, signature
158px at 21px/16px insets, feature gap 61px, heading gap 56px, frame→features gap 32px.

- **Media frame:** white fill, 1px `--qi` border, `--border-radius`, 12px padding. V4's
  card is 502px tall from *asymmetric* 13px/15px insets (Figma rounding); this uses a
  symmetric 12px + 1px border, so the section is 935px vs V4's 937px. Deliberate.
- **Media ladder** mirrors `meet-the-icons.liquid`: uploaded video → external video URL →
  merchant image → the V4 still. The still is **`wp-meet-the-icons-bg.jpg`, reused** — the
  frame's exported poster is byte-identical (md5 match) to the one already vendored.
- **Play glyph** is `wp-play-button.svg` (byte-identical to this frame's export).
  When a video **is** set the media becomes Dawn's `<deferred-media>` (`assets/global.js`):
  the poster is a real `<button id="Deferred-Poster-…">`, the video/iframe lives in a
  `<template>` and is only fetched on click, and the poster hides once `loaded` is set.
  Dawn requires that exact id prefix and the `<template>` first-child to be the
  video/iframe. When no video is set the glyph stays decorative and `aria-hidden` — a play
  button that cannot play anything is a lie. `.aria-why__play` keeps
  `pointer-events: none` so clicks reach the poster button beneath it.
- **Signature** is `wp-kristi-signature.svg` (same path data, different viewBox scale).
  Sized and offset in **percentages of the media box** (158/846, 21/846, 16/474) so it
  scales with the frame instead of drifting at narrow widths.
- **Badge tint** is `rgba(var(--qi-rgb), 0.2)`, matching V4's `rgba(188,105,107,0.2)`
  exactly. Deliberately *not* a `color` setting — Shopify colors carry no alpha, so a flat
  hex would stop compositing correctly the moment a merchant changes `background_color`.

### Footer (`1:1033`, client file `6272:1528`) — BUILT
`sections/aria-footer.liquid` + `assets/section-aria-footer.css`, wired in through
`sections/footer-group.json` (`"type": "aria-footer"`). Dawn's stock `footer.liquid` is
deliberately **left on disk** — swapping the type back is the whole revert.

`#1A1A1A` band, content capped at **1215px** (narrower than the site's 1360 container).
Three 203px menu columns 80px apart on the left, a 323px newsletter column on the right,
and a full-width bottom bar at `px-56 py-12`.

- **Link columns are Shopify menus**, one `link_list` per block. V4's mock copy in this
  area ("Hunter Business Insider", "How to Choose a Ceiling Fan") is leftover from an
  unrelated ceiling-fan project and is deliberately not reproduced.
- **Payment icons: an allow-list INTERSECTED with `shop.enabled_payment_types`**, rendered
  through `payment_type_svg_tag` at 38×24. The `payment_icons` setting is a
  comma-separated list of Shopify payment-type handles; it can only ever *narrow* what the
  store genuinely accepts, never advertise a method a customer cannot pay with. Blank =
  show everything enabled (Dawn's behaviour). Default is the ten mainstream marks:
  `visa, master, american_express, discover, diners_club, jcb, paypal, apple_pay,
  google_pay, shopify_pay`.
  This store enables **17**, and the 7 dropped are region-specific European methods
  (`blik` PL, `eps` AT, `mb` PT, `mobilepay` DK, `przelewy24` PL) plus `maestro` and
  `unionpay` — noise on a US storefront, and they wrapped the row onto a second line.
  **Handle gotchas:** Mastercard is `master` (not `mastercard`) and Shop Pay is
  `shopify_pay`. Merchants type the brand name, so the section normalises the common
  aliases before matching — without that, a perfectly reasonable entry silently matches
  nothing and the icon just disappears.
  The set was **confirmed by the user on 2026-09-02** (Figma was quota-blocked, so it could
  not be read from node `1:1033` directly — the user verified it against the frame).
- **The bottom bar is 48px, and that is V4-exact** (`py-12` + a 24px icon row). An earlier
  note here claimed V4 was 58px and blamed the 82px render on the row wrapping; the real
  arithmetic is 24 + 10 + 24 = 58px of *wrapped content* + 24px padding = 82px. With the
  allow-list narrowing the row to one line the bar measures 48px. Do not "fix" it to 58.
- **Newsletter is the real `{% form 'customer' %}`** with `contact[tags]=newsletter`, and
  uses the translate-the-fallback-first pattern (see the Liquid gotchas section).
- **Social blocks** reuse the About Wig Party pattern: Dawn's `icon-<platform>.svg`
  glyphs, `#` placeholder until a URL is set, 34px at ≥1280 and 44px on touch.
- **The wordmark is a BAND, not a background wash.** V4 places it at y 455–690, a full
  235px band *below* the link columns (which end at ~383) with 72px of air above it, and
  lets the opaque bottom bar ride 11px over its base. Building it as
  `position: absolute; z-index: -1` was wrong: it landed 130px *inside* the columns and
  collapsed the footer from 737px to 521px. It now sits in normal flow between
  `__inner` and `__bar` and reserves its own height; the bar carries `z-index: 1` so it
  still covers the base. Verified: band 455→690, 72px gap, 11px overlap — V4-exact.
- Gradient-clipped text at 14% opacity. V4's 235px is fixed; here it is
  `clamp(64px, 16.3vw, 235px)` because a fixed 235px is several screen-widths wide on a
  phone. Verified contained at 375px (64px) and 768px (125px).
- Footer renders **774px** against V4's 737 (was 760 with the 17-icon wrapped bar). The
  delta is *not* the bar — that is now 48px and V4-exact. It is the link columns: they
  render 430px tall where V4 mocked 383px, which slides the wordmark band from V4's
  455→690 down to 502→737. Cause is the next bullet (real menus hold different link
  counts), i.e. content, not layout. The structural relationships are all exact and were
  measured: 72px air above the band, band exactly 235px, bar riding 11px over its base.
  Arithmetic: 430 + 72 + 235 + 48 − 11 = 774.
- **At 768 the icon row still takes two lines** — the inline legal menu leaves only 272px
  of the bar and ten marks need 470px. Right-aligned, no overlap, no overflow; V4 has no
  tablet footer frame to conform to. At 375 the bar stacks and the row centres on two
  lines (343px available). Only ≥1280 fits all ten on one line.
- The store's real menus hold 6/1/7 links where V4 mocked 8/8/5, so the columns are
  shorter than the design until proper footer menus are built in Admin → Content → Menus.

### Join the Party (`1:917`) — BUILT
`sections/join-the-party.liquid` + `assets/section-aria-join-the-party.css`.
Full-bleed background photo with V4's diagonal scrim
(`linear-gradient(118.89deg, rgba(47,47,47,.46) 12.738%, rgba(222,222,222,.46) 78.602%)`)
as a real element, so a merchant photo sits beneath it untouched. Frosted panel `p-40`,
`gap-64`, holding a **471px** copy column and a **529×536** collage.

- **The form is Shopify's real `{% form 'customer' %}`** with `contact[email]` and the
  `contact[tags]=newsletter` hidden input — the same contract Dawn's newsletter section
  uses, so submissions actually create a subscriber. V4's mock field is reproduced as
  styling only (h56, `#ddd` border, radius 2, translucent fill).
- **Collage geometry is percentage-based** off the 529×536 box (244×365 @ 285/73.5,
  199×297 @ 94/17.3, 188×235 @ 0/234.5, 189×284 @ 161/236.1), so the overlap scales as one
  unit. Verified pixel-exact at 1440. Hidden below 990px, where the overlap turns to noise.
- The background default reuses `wp-find-texture.jpg`; V4's own export is only 531×606, so
  it is soft when stretched full-bleed. The `image_picker` info string says to supply
  ≥1920px.

### @WigParty on Instagram (`1:975`) — BUILT
`sections/instagram-feed.liquid` + `assets/section-aria-instagram-feed.css`.
Gradient `#FFFFFF → #EADDD4`, `px-40 py-80`. **Shoppable** UGC carousel: each block takes a
lifestyle photo *and* a `product`, and the strip under the photo renders the product's real
title, `money` price and a quick-add button — nothing in it is hardcoded copy.

- Reuses the shared `aria-product-carousel.js` (`slidesPerView` **3.59** at desktop,
  `spaceBetween` 8) plus its progress-fill and prev/next hooks. Media ratio **384/548**.
- **The track starts on the container gutter and bleeds off the RIGHT edge** (client
  decision, settled after two rounds of feedback). At >=990px `.aria-insta__swiper` gets
  `width: calc(100% + 40px); margin-inline: 0 -40px`, so the first card sits at the 40px
  gutter and the row runs to the viewport edge, cutting the next card — the shoppable
  "peek". Only the track bleeds; the heading and progress/nav controls stay on the 1360
  grid, which is why the rule is on `__swiper` and not `__carousel-wrap`. The -40px
  consumes exactly the section's own right padding, so it cannot cause page scroll.
  `slidesPerView: 3.59` keeps the card at V4's 384px in that 1400px visible track.

  > V4 sets this row to a fixed **1400px** inside a content box that is only **1360**
  > (node `1:980`, `justify-center`), which centres it and leaves a 20px sliver on BOTH
  > sides. That was implemented literally at first and rejected — it reads as the slider
  > touching both edges and breaks the container rhythm every other section follows.
  > Treat the 1400 as an auto-layout artifact, not a symmetric 20px bleed.

  No bleed below 990px: the track stays inside the gutter (16px mobile, 40px tablet),
  where the next card already peeks at the container edge.
- Reuses `snippets/aria-product-card-quick-add.liquid` for the `<product-form>` wiring, but
  **does not** load `component-aria-product-card.css` — the button is styled through
  `.aria-insta__bar .aria-product-card__cart-btn` descendant rules instead of pulling in a
  whole stylesheet for one control. `product-form.js` must stay included for that element.
- Prev is 60px outlined on `#a9aab5`, next is 64px filled `--py` — the same control pair as
  Best Sellers.

#### Add to Cart (2026-09-08)

The section already rendered the shared `aria-product-card-quick-add` snippet and already
loaded `product-form.js`, so the AJAX add, cart drawer, count bubble, loading state and
in-flight duplicate guard were all present and correct — verified: the right variant lands
in the cart, three clicks during one in-flight request still add exactly one item. No cart
logic was written for this section. Two real defects were fixed instead.

**1. The button was invisible and unclickable at every width ≥750px.**
`component-aria-product-card.css` is emitted by Best Sellers *and* New & Trending, so it is
loaded globally on the homepage, and **its rules are not section-scoped**. At ≥750px it
collapses the quick-add wrapper for its own hover reveal:

```css
.aria-product-card__quick-add { width: 0; opacity: 0; overflow: hidden }
.aria-product-card:hover .aria-product-card__quick-add { width: 54px; opacity: 1 }
```

This section has no `.aria-product-card` ancestor, so that reveal can never fire. The 44px
button sat in a zero-width, fully transparent, clipped wrapper, spilling ~32px past the card
edge into the swiper's `overflow: hidden`. `elementFromPoint` across the entire button
returned `.aria-insta__bar`, never the button.

The section's own rule set `flex`/`display` but never `width`/`opacity`/`overflow`, so the
lower-specificity component rule supplied them. Fixed by declaring all three in
`section-aria-instagram-feed.css`, with `width: auto` so the wrapper hugs whatever size the
button is (44×44, or 44×32 from 1280px up) rather than pinning a number that would drift.
**The mega menu fixes the identical collision the same way** — see
`.aria-mega .aria-product-card__quick-add`. Specificity (0,2,0) beats (0,1,0); no
`!important`.

> **Lesson beyond this section:** `component-aria-product-card.css` is a *global* stylesheet
> whose selectors are bare component classes. Any section that renders a piece of the
> product card without being a `.aria-product-card` inherits the hover-reveal collapse and
> must neutralise it. Two sections have now hit this.

**2. A sold-out product's card had no button at all.** The render was wrapped in
`if post_product.available`, so such a card was silently different from its neighbours.
It now always renders, passing `is_sold_out` for the snippet's existing `aria-disabled`
treatment, plus a restated disabled style (this section deliberately does not load
`component-aria-product-card.css`, so the shared `[aria-disabled]` rule does not reach it).

> **This store runs Rebuy Smart Cart, and it ignores `aria-disabled`.** Rebuy's own script
> listens for add-to-cart clicks and posts `/cart/add.js` itself: with `aria-disabled="true"`
> the theme handler correctly returned (no loading class) and **Rebuy still added the item**
> (stack: `cdn.rebuyengine.com/.../global-*.js` → `addItem` → `processQueue`).
> `pointer-events: none` blocks a real mouse click but not a keyboard Enter on a focused
> button. So the quick-add snippet gained an **optional** `hard_disable` param that emits the
> native `disabled` attribute — a natively disabled button cannot be focused or activated, so
> neither the theme nor an app handler can fire. Only this section passes it; every other
> call site renders byte-identically. Verified: with it, no `/cart/add` fires at all.

No variant selector exists here, so the snippet's default
`selected_or_first_available_variant.id` is what posts — a variant id, never a product id
(verified: all five hidden inputs hold 11-digit variant ids).

### Trust badges (`1:1001`) — BUILT
`sections/trust-badges.liquid` + `assets/section-aria-trust-badges.css`. No JS.
Four blocks, 64px icon, `gap-16` to a `gap-8` text pair (Montserrat Medium 20/28 +
Poppins 14/22 `#3f3e3e`).

- Desktop uses **fixed `repeat(4, 255px)` with `justify-content: center`**, not `1fr`
  columns: with `1fr` the 70px gap became 70px *plus* the leftover column slack, and the
  centred items shrank to their content width instead of V4's 255px measure.
- 2-up below 990px. Four columns at 768px came out ~138px each, too narrow for a 20px title.
- Icons ship as `wp-trust-*.svg` with an `image_picker` override, the same `default_icon`
  select pattern as `start-here.liquid`.

### About Wig Party (`1:942`) — BUILT
`sections/about-wig-party.liquid` + `assets/section-aria-about-wig-party.css`.
`pt-80 pb-20 px-80`, copy column and a **680×625** photo bottom-aligned with a 20px gutter.
Copy ladder: 15px chip→heading, 16px→body (481px measure), 12px→tagline, CTA **211×52**.

- **Social row reuses Dawn's `snippets/social-icons.liquid`** driven by the store's
  `social_*_link` settings, restyled to V4's circles. Deliberately *not* four glyphs of our
  own: the V4 exports carry no platform labels and mislabelling a brand mark is worse than
  reusing the correct, already-translated set. **All nine `social_*_link` settings are
  currently empty, so the row renders nothing** until they are filled in under
  Theme settings → Social media.
- Signature uses `wp-kristi-signature-dark.svg` — the same path data as the white
  `wp-kristi-signature.svg` but black, since this section is on white. A percentage
  `max-width` here shrank it to ~290px; it is pinned at its full 345px.


---

## 10. Assumptions & Approximations

Log every judgement call here rather than deciding silently.

1. **`aria-*` namespace retained** after the Wig Party rebrand — see §1.
2. **Meet the Icons** built without a Figma reference, using placeholder media (client-approved).
3. **Wishlist is `localStorage`-only.** A "Wishlist by Square" app integration was
   attempted and reverted: the app embed on this store is Vitals-based and exposes no
   documented custom-button API, so the theme owns the wishlist state. It is
   per-browser and does not sync to a customer account.
4. **Product card badge styling is uniform.** Figma shows per-tag colours
   (pink / orange / dark), but tag *text* comes from a merchant metafield — colour-coding
   would require hardcoding tag strings in Liquid, which the brief forbids. Sold-out
   (a system state) keeps its distinct red.
5. **Collection card hover** = CSS `scale`, not a second image. Shopify collections have
   no native "hover image" field.
6. Mobile layouts are an implementation decision wherever Figma provides desktop only.
7. **Start Here card border.** Figma specifies a *white* border. That reads correctly on
   desktop (one row, sitting on the peach half of the gradient) but disappears on mobile,
   where cards wrap onto the white half. Substituted a 10%-alpha brand tint
   (`rgba(--qi-rgb, .1)`) — invisible against peach, defines the edge against white.
8. **Heading font switched to Montserrat Medium** (`montserrat_n5`) in both
   `settings_data.json` and the `settings_schema.json` default, per V4 and confirmed with
   the client. This is global — all pre-existing sections now render Montserrat headings
   with Poppins body copy.
9. **Best Sellers background is a gradient**, which Shopify `color_scheme` settings cannot
   express. Replaced the section's `color_scheme` setting with two `color` settings
   (`background_gradient_start` / `_end`) fed into CSS custom properties.
10. **Why Wig Party ships one feature icon, not three.** V4 draws all three badges with
    the *same* placeholder glyph (a "FREE shipping" mark — the two exported SVGs differ
    only in 4th-decimal float rounding). Exported once as
    `wp-icon-free-shipping.svg` and used as the built-in default; each block takes an
    `image_picker` override. The Start Here icon set was **not** offered as a `select`
    here — those are 120px line-art guide icons and would be illegible at 28px.
11. **The media still uses `object-fit: cover`, not V4's exact crop.** V4 zooms the
    placeholder ~1.46× with a focal offset (65.7% / 38.7%), which `cover` cannot express
    on this aspect ratio. Since the still only stands in for merchant-supplied video,
    a hardcoded crop would fight whatever they actually upload.
12. **Header nav uses `scheme-1` (light), not `scheme-4`.** `sections/header-group.json`
    had `nav_color_scheme: scheme-4` (bg `#000`, fg `#fff`), which rendered the whole
    navigation band black with white text — V4 specifies a **white band with black text**.
    The announcement band correctly keeps `scheme-1` and inverts it to black/white in CSS.
    Several header rules also hardcoded `rgba(255,255,255,…)` borders that were invisible
    on a light scheme; they now derive from `--color-foreground`.
13. **V4's 36px icon buttons and 39px Watch Live pill are applied only at ≥1280px.**
    Those sizes fall below the theme's own 44px tap-target rule (§4.5). They are used at
    the width where the header is mouse-driven and the inline nav is active; every width
    that uses the hamburger keeps 44px. This is the one deliberate departure from
    pixel-exact V4 at small sizes, and it is an accessibility floor, not a preference.
14. **The nav carets can't render:** V4 shows dropdown chevrons on Shop / Best Sellers /
    Start Here, but the store's `navigation` menu has **no child links**, so no
    `--dropdown` items exist. This is store data, not code — add submenu items in Shopify
    Admin (Content → Menus) and the carets and dropdowns appear automatically.
15. **The V4 file reuses the same handful of stock photos across frames.** Before adding a
    downloaded export, fuzzy-compare it against `assets/` — exact hashing fails because the
    vendored copies are JPEGs and the exports are PNGs of the same source. A mean-absolute
    difference under ~6 at matching dimensions means it is the same photo re-encoded. Doing
    this for Join the Party and About Wig Party found 5 of 6 photos already vendored
    (`wp-ugc-featured`, `wp-find-length`, `wp-ugc-photo-1`, `wp-find-texture`), so only one
    new image was added instead of six.
16. **Social icons use Dawn's glyphs but section blocks, not Dawn's snippet.** The V4
    exports are unlabelled 16px paths and guessing which is Facebook vs TikTok risks
    shipping a wrong brand mark, so the glyphs are Dawn's `icon-<platform>.svg` assets
    inlined with `inline_asset_content`. Dawn's `social-icons.liquid` snippet was tried
    first and **rendered nothing**: it only emits platforms whose `social_*_link` theme
    setting is filled in, and all nine are empty on this store. Each link is now a
    `social` block (platform select + url) so it is editable in place, and a block with no
    URL yet still shows its icon on a `#` placeholder rather than leaving the row blank.
18. **Swatch pitch is 22px, not V4 19px, and the selected ring is ours.** V4
    `I1:473;6283:597` is five 15px discs at x = 0/19/38/57/76 (4px gaps) and specifies **no
    selected state at all** — the ring is a theme addition the brief requires. A ring needs
    ~3px of clear space per side, which 4px gaps cannot supply, and drawing it *outside* the
    disc is what put it past `.aria-best-sellers__swiper { overflow: hidden }` and got it
    cropped. The ring therefore lives inside a 22px button box (see section 6a): disc size
    (15px), left alignment with the title, and radius all stay exactly on design; only the
    pitch moves, by 3px per swatch. Both alternatives were worse — a 19px pitch leaves no
    room for a visible ring, and outward rings clip at the container edge at every
    breakpoint.
19. **Per-variant availability disables the quick-add button,** including on first load.
    V4 has no state for a sold-out *colour* on an in-stock product. Leaving it enabled
    posted a doomed `/cart/add` that failed invisibly (`data-hide-errors="true"`), so the
    existing `aria-disabled` treatment on `.aria-product-card__cart-btn` is reused. Because
    the client asked for the **first** colour to be the default (deviation 20), and that
    colour is a sold-out placeholder on most Belle Tress products, this means the button
    starts disabled on those cards. Flagged to the client; the fix belongs in the store's
    option values, not the theme.
20. **Default colour is the first real option value, not `first_available`.** Client
    decision, 2026-09-08, overriding the earlier "ring whatever the form posts, which is
    `selected_or_first_available_variant`" rule. Both are self-consistent — the ring and the
    cart always agree.
21. **New & Trending uses the Best Sellers card, not V4 node `1:674`'s own card.** V4 draws
    a different card for this section (262/320 media, in-image quick-add, no View Product);
    the client asked for one card design across the homepage, so the compact variant was
    deleted. Section-level layout (heading, spacing, gradient, 5-up slider) still follows
    V4. If a future V4 pass wants the compact card back, see §9 New and trending for the
    exact values that were removed.
22. **Instructional colour values are hidden from the card.** Values whose name reads as a
    prompt (`choose` / `dropdown` / `drop down`) are skipped: they are not colours, and as
    the first value they made the tooltip read "Choose Color From Drop Down" and became the
    default variant. Matched on prompt wording, never on a colour name. The merchant-side
    fix is to remove those option values from the products. See section 6a.
17. **Why Wig Party stays 3-up on mobile, and the labels wrap to 3 lines.** V4 gives no
    mobile frame (see #6). Two-line labels are geometrically impossible 3-up at 375px —
    "Authorized Belle" needs ~115px/column and only 343px is available — so the choice is
    3 lines or breaking up the trust row. Kept the row intact: nothing clips or overflows
    at 320px, which was verified rather than assumed.

---

## 11. Testing Checklist

Verify against the **live preview**, not by reading code.

- [ ] Renders at **375 / 768 / 1024 / 1440px**
- [ ] No horizontal overflow at any width (incl. 320px)
- [ ] All tap targets ≥ 44px
- [ ] Header: nav visible, no overlap at 1024px; mobile drawer opens **and closes**
- [ ] Search opens, returns predictive results, suggestions clickable, Escape closes
- [ ] **Overlapping controls actually reach the pointer** — for the search dropdown
      rows, the hero Watch Live badge, and any play glyph, probe
      `document.elementFromPoint(cx, cy)` at the element's centre and assert it returns
      that element or a descendant. Rendering correctly proves nothing about hit-testing
      (see §5 gotchas 6 and 7); both of those bugs were invisible in screenshots.
- [ ] Cart button opens the **drawer**; count updates after add-to-cart
- [ ] **Product card swatches** (Best Sellers *and* New & Trending): clicking a swatch
      swaps to that variant image, moves the ring, and puts **that** variant in the cart —
      not the first one. Check a second card afterwards to prove state is per card.
- [ ] **Initial state:** the **first** colour is ringed, the second is not, the **featured**
      image is showing (no variant image pre-swapped), and the quick-add hidden input holds
      the first colour's variant id. Then click the first colour — its own variant image
      must appear only now.
- [ ] **"+N more colours"** reveals every colour in that card only, with no duplicates, no
      reordering, and the ringed colour still ringed; the control disappears afterwards and
      is absent entirely on products with ≤5 colours. A revealed colour must behave exactly
      like an originally visible one, cart included.
- [ ] **Colour-name tooltip** appears on hover, on keyboard focus and on selection, names the
      right colour, and never overhangs the card — check the first and last swatch, and a
      swatch on the wrapped second line after expanding.
- [ ] **A New & Trending card and a Best Sellers card are indistinguishable at card level**
      — diff the computed styles rather than eyeballing: media ratio, radii, padding, gaps,
      title/price type, swatch box, View Product height, cart button and icon, badge
      position. Card *width* is expected to differ (5-up vs 4-up slider).
- [ ] **No instructional pseudo-value is rendered as a swatch** (nothing matching
      `choose` / `dropdown` / `drop down`), the first swatch is a real colour, and the
      "+N more colors" count equals the real colours minus the five shown.
- [ ] **Swatch ring is never clipped.** Measure rather than look: each swatch
      `getBoundingClientRect()` must sit inside its card *and* inside `.swiper`. Check the
      **first** swatch specifically, at every breakpoint.
- [ ] Variant with no image of its own falls back to the product featured image; a
      one-variant product renders no swatch row and still adds to cart
- [ ] Swiper: drag, arrows, progress bar tracks position, no overflow
- [ ] Education & Guides: guides are plain `<a>` links, all three identical with no
      selected state, nothing in the list changes the image; images cross-fade on their own
- [ ] Real Customers: every slide is a `<video autoplay muted loop playsinline>` with **no**
      `controls` attribute; play/pause sits bottom-left and sound bottom-right, never
      grouped and never clipped; unmuting one slide mutes all the others; navigating slides
      neither duplicates a video nor moves the audible one
- [ ] **Cross-section audio:** unmute a Real Customers slide, then unmute Why Wig Party —
      the slide must go silent, and vice versa. At most ONE video audible anywhere on the
      page at any time, and unmuting must never pause anything. Why Wig Party autoplays
      muted with the same custom controls and no native control bar.
- [ ] @WigParty on Instagram: every card has a **visible and hit-testable** Add to Cart —
      check `getComputedStyle(wrapper).opacity` is 1 and `elementFromPoint` at the button's
      centre returns the button, at 1440 **and** 768; the globally-loaded product-card CSS
      collapses this wrapper to `width: 0; opacity: 0` if the section stops overriding it
- [ ] Deals & Exclusives: every collection card shows View More, each linking to **its own**
      collection; the card is a `<div>` and clicking the image/title still opens the
      collection through the button's stretched `::after` (one tab stop per card)
- [ ] Wishlist: heart a product → drawer opens with it; Remove updates storage and UI with
      no reload; Add to cart puts the right variant in the cart, removes the row **only on
      success**, and hands over to the cart drawer with the page still scroll-locked; last
      removal shows the empty state; the list scrolls while header/footer stay pinned
- [ ] Start Here: **2 columns on mobile**
- [ ] Start Here card hover lifts 4px with a shadow on all six cards, is inert at 375px,
      and leaves the `.aria-mega--start-here` menu panel completely unchanged (different
      component, confusingly similar name)
- [ ] Empty states: no product/collection selected, sold out, no compare-at price,
      no second image, no reviews (⇒ unfilled stars), empty metafield
- [ ] Theme Editor: every section's settings render and apply
- [ ] `shopify theme check` → 0 errors
- [ ] Browser console → 0 errors

---

## 12. Deployment

- **Never** push to the live theme. Push only to an **unpublished development theme**.
  Live theme on this store is `[REBUY LAUNCH]` — never touch it. Dev theme: **#167260880985**.
- Push **one file per CLI call**, then **pull it back** to confirm it landed.
- Verify via the **preview-theme-pinned** URL.

### Working-directory hazards (both of these have bitten — do not repeat)

1. **Never run `sed -i` or `perl -i` on files inside the theme directory.** They write a
   temp sibling (`sections/sed1FGjIa`) which `theme dev` immediately tries to upload,
   failing with *"Must have a .liquid file extension"* and jamming the upload queue for the
   whole session — every page then serves "Failed to Upload Theme Files". Recovery is a full
   dev-server restart. Edit files in place with a real editor tool, or write the transformed
   file to the scratchpad and move it in.
2. **`sections/` legitimately contains non-`.liquid` files.** `header-group.json` and
   `footer-group.json` live there and are referenced by `layout/theme.liquid`
   (`{% sections 'header-group' %}` / `'footer-group'`). Never "clean strays" with a blanket
   `find sections -type f ! -name "*.liquid" -delete` — it deletes the section groups and
   takes the header and footer off every page. There is no git history here to recover from,
   and `theme dev` propagates the deletion to the remote dev theme within seconds, so a
   `theme pull` will not get them back either.

### Store menus (recovered by enumerating `linklists`)

The header's `main_menu` must be **`navigation`** — the 7-item V4 menu (Shop, Best Sellers,
Start Here, Live, Community, Dailey Deals, Pre-Order). It is **not** `main-menu`, which is
the store's real 20-item menu and blows the header out to 3650px, causing ~2470px of
horizontal page scroll. Other menus on the store: `footer` (6), `tutorials`,
`customer-account-main-menu`, and two legacy child menus.

> `shopify theme check` is slow on this machine (multi-minute, occasionally OOM-killed
> at exit 137 when run alongside `theme dev`). The `theme dev` server validates Liquid
> syntax on every save and surfaces errors inline — that is the fast feedback loop.

---

## 13. Future Development Notes

- Promote repeated V4 literals (`#FAF8F5`, `#F5EBE2`, `#2B2C2B`) to `style.css` tokens
  once used in 3+ sections.
- `custom.feature_tags` must be created as a real metafield definition in Shopify Admin
  (Settings → Custom data → Products) — it is currently empty, so no badges render.
- Wishlist could move to a customer-account-backed store if cross-device sync is wanted.
- Consider a shared `aria-section-header.liquid` snippet — the rating-pill + heading +
  subheading cluster repeats across Best Sellers, New & Trending, and others.
