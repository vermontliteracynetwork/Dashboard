# 21. Accessibility and sensory design

> **v11 note:** the complete accessibility specification (WCAG 2.2 AA plan, settings, input, screen reader, dyslexia, autism, sensory and testing) is section 24. This section keeps the earlier sensory notes; where they differ, section 24 wins.

- **Type:** Lexend (or OpenDyslexic as an option), 18px minimum, line-height 1.5, letter-spacing about 0.02em, left aligned, off-white or pale mint background (not pure white), dark text. Words are never in all caps.
- **Targets:** every button at least 56px tall; reel windows at least 88px wide; spacing of at least 8px between targets (fine-motor friendly).
- **Read aloud:** on by default; slow voice option; tap any word to hear it; highlight words in sync if the browser supports boundary events.
- **Color is never the only cue:** every symbol also has its shape and name label.
- **Predictable:** the same layout every time, one primary action (SPIN), no surprise popups, no countdowns, no sudden loud sounds (cap volume low). Sound toggle and calm mode are one tap from the machine screen.
- **Errors:** there is nothing to get wrong. If a combination is impossible, the app quietly picks another.
- **Keyboard and screen reader:** Space or Enter spins; aria-live region announces the finished sentence; locks are real toggle buttons with labels.
- **Dark mode:** support prefers-color-scheme, but default to the light mint theme for the students.
