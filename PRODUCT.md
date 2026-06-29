# Product

## Register

product

## Users
Football analysts, bettors, and enthusiasts who want data-driven match predictions backed by a continuously trained model. They use this during match week — pre-match (checking picks and odds), live (tracking games), and post-match (reviewing model accuracy). Primary device: desktop, secondary: mobile. Primary context: at home or at a sports bar before or during matches. They're comfortable with probabilities and odds but want the model to do the interpretation work.

## Product Purpose
An immersive prediction engine for the 2026 World Cup and club football. The model trains continuously on match data and surfaces high-confidence predictions with odds context, daily slips, parlays, and futures. Success means users trust the model's picks — especially the high-confidence band (≥55%) targeting ~88% accuracy — and return each matchday to check new predictions, track the bankroll, and follow the bracket.

## Brand Personality
Authoritative, clinical, earned. Like a broadcast analyst who's done the work before going on air — not flashy, but commands attention when it speaks. The data is the spectacle, not the UI. Three words: **authority**, **precision**, **momentum**.

## Anti-references
- Bet365 and casino-adjacent betting sites: loud, banner-heavy, CTA overload, neon on black
- FBRef-style pure data: data-dense but aesthetically invisible, no confidence hierarchy
- Football Manager: game-y, skeuomorphic, crowded interface
- Generic dark-mode sports dashboards: navy + neon green + gradient text everywhere (the saturated AI attractor)

## Design Principles
1. **Data earns its place.** Every number on screen answers a specific user question. No metrics for decoration.
2. **Confidence speaks first.** The model's confidence level is the primary signal; odds are context. Layout hierarchy reflects this.
3. **Broadcast clarity.** Complex data presented with the precision and economy of a live broadcast graphic — instant comprehension, no noise.
4. **Motion advances the story.** Animations are camera-cut transitions and data-reveal moments, never decoration.
5. **The interface disappears.** Users should feel like they're reading the analysis, not operating the tool.

## Accessibility & Inclusion
WCAG AA (4.5:1 body text minimum, 3:1 large/UI text). `prefers-reduced-motion` support throughout — all GSAP animations have instant/crossfade fallbacks. Color is never the sole data carrier; labels always accompany color coding for pick direction and confidence states.
