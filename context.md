## Space Background Notes

- File: `docs/space-background.js`
- Stars: 3 parallax layers with per-star twinkle, pulse, and GSAP-aware warp streaks. Warp can be triggered via global `space-warp` event and supports data attributes: `data-warp-duration`, `data-warp-intensity`, `data-warp-ramp-in`, `data-warp-ramp-out`, `data-warp-ease`, `data-warp-delay` on `[data-warp-trigger]` elements. Warp sets `window.__warpAnchor` but dust visibility is now driven independently.
- Milky Way/nebula: warm-to-cool linear gradient plus faint magenta nebula overlay drawn with `lighter` blend in `drawStars()`.
- Dust: 18 small glowing flecks (size ~1.6–4.8px), hidden until warp. Drift now includes per-particle max drift caps plus damping, so velocity can’t explode and particles lazily meander. Motion is scaled by `dustConfig.speed` (default 0.00025) relative to `DEFAULT_DUST_SPEED` 0.0075, meaning smaller values slow everything uniformly. Frame deltas are factored in so motion feels consistent even after pauses. Rendered with shadow blur for a soft glow.
- Star movement: parallax motion uses a 1/5th multiplier for desktop and is disabled entirely on mobile devices via `STAR_PARALLAX_SCALE`/`isMobileDevice`, so the background stays still on touchscreens; the animation loop only runs on desktop (`shouldAnimateStars`) while mobile renders the stars/dust once and then freezes, avoiding scroll-driven jitter.
- Controls: wrap `[data-space-bg]` sections can take several flavoring attributes:
  * `data-space-bg-stars="false"` or `data-space-bg-nebula="false"` to drop specific layers while the rest stay active.
  * `data-space-bg-stars-region` (`full`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `center`) to limit the star spawn area.
  * `data-space-bg-warp="false"` to disable warp/dust-intensifying streaks per section and `data-space-bg-dust="true"` when you still want dust even without warp; `data-space-bg-dust-count` controls how many specks (default 18).
  * `data-space-bg-img-parallax="0.2"` (or other number) to turn on the desktop-only image parallax and move any `.u-background-slot` child in sync with the shimmer.
- Background parallax: `data-space-bg-img-parallax` now drives `updateBackgroundParallax()` on `mousemove`, nudging the section’s background position and translating any `.u-background-slot` wrapper when present, so the mouse-driven shift works even though Webflow keeps the real image inside that slot; the effect is still desktop-only (`bgParallaxActive` requires parallax value and non-mobile).
- Dust toggles: `data-space-bg-dust` now controls whether the glowing dust layer renders (defaulting to whatever `data-space-bg-warp` is set to), letting a warp-disabled section still show dust when you explicitly opt in.
- Warp effects: `triggerWarp` now short-circuits on `isMobileDevice`, preventing the intensity/dust spike (and related `space-warp`/`startSpaceWarp` events) from running on phones/tablets that already keep the stars static.
- Anomalies: Occasional fast streaks spawned probabilistically.
- Mouse: Parallax for stars, pull on dust, mousemove handler per target.

## Space Bull Notes

- File: `docs/space-bull.js`
- Animated bull outline: it loads a `data-bull-src` SVG, clears explicit dimensions, injects helper styles, and normalizes strokes for each `data-bull-path-selector` path before drawing.
- Customizable via attributes (`duration`, `base-delay`, `stagger`, `easing`, `fade`, `threshold`, `root-margin`, `repeat`, `laser-spread`, `beam-glow`, `glow-strength`, and particle tuning such as rate/duration/spread/size). Lasers default to opposite fill colors and optionally emit particles from a pooled emitter (`particlePool` size, `particleRate`, `particleSpread`).
- Triggers: hosts register names from `data-bull-trigger` and their `id`s, then expose `window.spaceBullTrigger`/`spaceBull.trigger`/`spaceBull.play` APIs plus `window.triggerSpaceBull`. Calling them restarts GSAP timeline if available; fallback uses CSS animation on stroke dash offset.
- Timeline: if GSAP and DrawSVG plugin exist, creates timeline drawing each path sequentially, moves laser heads/beams, and emits particles when available. While drawing, toggles `.space-bull--paths-ready` and hides lasers afterward.

## Spotlight Notes

- File: `docs/spotlight.js`
- Final: `docs/spotlight.final.js` preserves the latest state after the idle-triggered auto-oscillation tweak.
- Desktop spotlight follows the mouse but when the cursor sits still for five seconds it begins auto-oscillating the mask center so the glow keeps shifting slowly; the animation stops again as soon as movement resumes.
- Mobile behavior simply centers the spotlight and allows click/tap updates with a higher opacity so content stays legible.

## Recent Conversation Notes

- Added/expanded `context.md` to capture details for `docs/space-background.js` plus the new `docs/space-bull.js` behaviors (SVG loading, lasers, particles, GSAP/fallback triggers). This note keeps tracked context for future tasks.

## Dash Bunny Notes

- File: `docs/dash-bunny.js` (minified bundle: `docs/dash-bunny.min.js`, shipped via CDN).
- Version 1.1.16 (previous live) handled autoplay + lazy loading but stopped playback completely on mobile after scroll/visibility changes, so users returning to the hero caused a fresh CDN pull.
- Version 1.1.17 introduces mobile scroll/touch resume logic:
  * `IntersectionObserver` still pauses when offscreen, but mobile hooks (scroll, touch, pointer, visibility) trigger `play()` again whenever the hero returns to view and buffered data is available.
  * Manual pauses are respected; resume only fires if the user didn’t explicitly pause.
  * Adds helper utilities (`subscribeMobileResumeEvents`, `hasBufferedAhead`, `isLikelyMobileViewport`) so multiple players can share throttled listeners.
- Version 1.1.18 further improves wake-from-sleep behavior by forcing a replay attempt after `visibilitychange`, `pageshow`, or the first scroll/touch post-wake even if `readyState` dropped below `HAVE_FUTURE_DATA`. This prevents the hero video from getting “stuck” after the phone sleeps while still honoring manual pauses.
- Landing pages load the dedicated dash-bunny tag from jsDelivr so these changes roll out independently of other assets.
