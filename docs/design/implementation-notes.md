# Vclarity landing page — design and validation

## Architecture and tokens

Hero/browser demonstration → three-mode feature showcase → motion capture → capture/analyze/generate/export → practical use cases → eight product FAQs → final preview download.

Actual extension identity takes precedence: Inter; blue #365CF5; white #FFFFFF; secondary #F8F9FB; soft blue #EEF2FF; ink #15171C; muted #69707D; border #E6E8EC. A single navy motion section (#101929) occupies a minority of the page. Every other section uses light surfaces.

## Subject inventory and argument

- Angular V logo and lowercase vclarity. wordmark.
- Exact (DOM) provenance for actual browser measurements.
- Live Inspect / Alt + I.
- Ghost Inspect / Alt + S, selected visual region.
- Motion & code introduced in version 0.2.0.
- Hold region: draw, stay stationary while held, release to finish.
- Record tab: toggle recording, then Stop.
- Both recording modes capped at 30 seconds; no audio.
- Consent precedes automatic submission of completed captures.
- Generated HTML/CSS/JS can be copied or downloaded.
- Actual processing stages, no claimed internal reasoning or fake backend activity.
- Developer preview ZIP, with no verified Chrome Web Store URL.

Claims and proof: inspect CSS precisely (real computed style demo); see larger structure (region selection and labeled example interpretation); understand motion (two operable recording simulations); leave with a starting point (real copy and export); know the limits (product-specific FAQ and setup guide).

## Direction and concept

Design-taste draw: **The product performs**, seed **565200025**. Brand palette/type retained. The subject’s own DOM-versus-AI distinction becomes the visual device: exact measurement boxes lead into larger visual selections, then motion evidence and editable code. Visitors can select elements and read their real CSS, switch modes, and operate both recording demonstrations.

The user’s brief takes precedence over conflicting style defaults: centered hero, realistic browser frame, thin software borders, restrained product-preview shadow, keyboard keycaps, release labels, and monospace technical values are intentional. No unrelated stock photography or decorative illustrations were introduced. The interface specimens are original HTML compositions, explicitly labeled illustrative; real screenshots are included in the setup guide and assets. The sage Layers page and coral Folio motion study are fictional demo websites, never claimed as customers or testimonials.

## Content integrity

Product behavior was cross-checked against the referenced development chat and existing extension source/docs. Only public branding, screenshots, font, and the compiled release ZIP were copied. No extension implementation was modified. No analytics or external font requests were added. No backend analysis is fabricated by the marketing demo.

## Validation record

Production build: `npm run check` and `npm run build` pass. No dependencies were installed.

Playwright: **20/20 result groups pass on the production build**, covering real computed CSS, both ARIA tablists, native dialog focus restoration, mobile navigation, clipboard contents, both downloads, keyboard and pointer recording controls, both 30-second automatic limits using an accelerated clock, reduced motion, FAQ keyboard behavior, metadata, font loading, and console/page/network errors. Widths: 1440, 768, 390, and 320px. No document overflow at any tested width; no console, page, or failed-request errors. The downloaded example ZIP was extracted successfully and its JavaScript passes `node --check`.

The installation guide also has no overflow at 1440, 390, and 320px. A separate JavaScript-disabled browser context confirms readable content and the installation-guide fallback.

Design inspector on the production build: **0 FAIL** at 1440/768/390. User-requested borders, keycaps, release labels, technical typography, and small screenshot captions are recorded allowances. Remaining style warnings concern the fictional specimen's warm background, dense software typography, intentional quiet motion, and the absence of unrelated photography/footage. System monospace fonts are intentionally used for real code; the inspector's web-font detector does not recognize installed Consolas as a loaded web font. Secondary copy meets AA contrast; selected software specimens use denser type than public reading copy. A final targeted pass also darkens provenance labels and specimen captions and enlarges pointer controls.

### Final visual critique

ROUND 3

Seen in one second: the headline, followed by the browser and exact CSS inspection.

Idea: the same interface is examined as a DOM element, a visual region, and a moving interaction, with the evidence type explicit each time.

Live thing: select elements, read their actual CSS, operate recording demos, and export working example files.

Layout words by section: hero=centered product / modes=interactive split / motion=full-width navy stage / workflow=sequence and workbench / uses=editorial list / FAQ=question column / close=centered action.

Self-review scores: design 8.0 · usability 8.2 · creativity 7.3 · content 8.6 → overall 8.0. This is a qualitative self-review, not an external benchmark.

Caps: the brief's explicit software-interface, border, release-label, and restrained-motion requirements override conflicting generic gallery-style rules. No unrelated photography was added to satisfy an arbitrary image count.

Top three problems addressed:

1. Initial mobile CTA heading wrapped to three lines; its responsive size now keeps the requested headline to two.
2. Initial public copy was too small and pale; FAQ/use-case reading copy is now 16px and darker, with controls and disclosures enlarged.
3. Code tabs changed the workbench's height; the code viewport now keeps a stable height and scrolls internally.

Remaining limitation: the tiny type inside miniature webpage specimens is intentionally scaled, especially on phones. Main reading copy and functional controls are separate from those decorative website details. AI sequences use prepared example content. Before public hosting, set the real origin for social metadata and replace the preview CTA only when a verified store listing exists.

No third-party stock pictures or generated bitmap artwork were used. Authentic Vclarity assets and Inter's OFL license are bundled; fictional Layers/Folio specimen content is labeled illustrative and requires no customer approval or testimonial substitution.
