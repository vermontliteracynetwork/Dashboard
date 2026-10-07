# 28. Safety, privacy and compliance

> *This section is a design checklist, not legal advice. Review it with your school or district privacy officer before using the game with students.*

## 28.1 Principles

- **Data minimization and local-first:** collect only what teaching needs; store it on the device by default; no accounts for students; no advertising; no third-party trackers or analytics; no remote servers unless the dashboard provides them.
- **Teacher control:** the teacher owns the data, can export and delete it, and controls every optional feature that stores personal content (voice recordings, buddy mail, contest, prizes).
- **Transparent:** a plain-language privacy notice and a student-friendly "What the game keeps" screen.

## 28.2 Regulatory considerations (United States, plus general)

| Law or standard | Relevance | Design response |
|---|---|---|
| FERPA | Student work, progress and reports are education records | Teacher-only access; exports under teacher control; no sharing with third parties |
| COPPA (children under 13) | Students are about 10 to 12 | No personal data collection by the app; school-authorized use; no behavioral ads; parental notice handled by school |
| State student privacy laws (for example California SOPIPA) | Restrict profiling and ads | No targeted advertising or profiling; data not used beyond the educational purpose |
| IDEA and IEP data privacy | Progress data may support IEP goals | Reports and exports are marked confidential; access is the teacher's |
| ADA, Section 504 and Section 508 | Accessibility obligations | WCAG 2.2 AA plan (section 24) and a conformance report |
| GDPR and similar (if used outside the US) | Data subject rights | Local storage, export and deletion tools make compliance straightforward |

## 28.3 Data inventory

| Data | Purpose | Stored | Retention | Who sees it |
|---|---|---|---|---|
| Profile (first name or nickname, avatar, settings) | Personalization | Device (IndexedDB, localStorage) | Until deleted | Student, teacher |
| Sentences, machines, scripts, posters, stories, Journal entries | Learning record and fun | Device | Until deleted; recycle bin 7 days | Student, teacher |
| Videos (exported) | Sharing and keepsakes | Device (blobs, optional) | Until deleted or space limits | Student, teacher |
| Voice recordings (optional) | Speaking practice | Device | Until deleted; off by default | Teacher; student optionally |
| Skill, attempt and prompt data | Instruction and IEP evidence | Device | Until deleted | Teacher |
| Contest entries, results, reward tickets | Recognition ledger | Device (or dashboard ledger) | Until deleted; audit trail kept | Teacher; student sees own results |
| Mood check-ins (optional) | Wellbeing signals | Device | Until deleted | Teacher |
| Teacher PIN | Access control | Device (salted hash) | Until changed | Teacher |

## 28.4 Security

- Teacher PIN stored only as a salted hash, rate-limited attempts, with an accessible alternative path (paste allowed; no puzzles or memory tests); locked area auto-closes.
- Strict Content Security Policy, no eval, no inline scripts, subresource integrity for any external asset, dependency scanning and a license check in CI.
- No student data leaves the device unless the teacher exports it or the dashboard bridge is connected by the school; the bridge sends only what is listed in 28.3.
- Backups: teacher-initiated JSON export and import; data integrity checks; deletion tool wipes everything for a student.
- On shared devices: profile switching clears the previous student's screen; sessions auto-close after inactivity; no student sees another student's work.

## 28.5 Content safety

- All content is curated and bundled; there is no student free-text input, no chat and no internet content in the game.
- Teacher-added words and pictures are filtered against a sensitive-word list and previewed in a sentence before they can be used.
- Buddy mail and contest results carry only sentences built from approved parts (they cannot contain arbitrary text).
- Voice recordings are local, optional, and off by default; consent is collected by the teacher.
- Cartoon violence is limited to slapstick (poofs and stars); the teacher can disable any verb.

## 28.6 Rewards, money and wellbeing safeguards

- The app never handles money (section 9.7). Prize tickets are records for the teacher, with limits, an audit trail and an on-off switch.
- No gambling mechanics: rewards are deterministic and the rules are visible; no random reward amounts or hidden odds; the delay before contest mail does not change results.
- No public ranking, no streaks, no time pressure; Break and Help always available; session reminders are gentle and off by default.
- Check school and family policy before offering cash or gift cards; offer alternatives (privileges, classroom items) in the ticket kind.

## 28.7 Documents to produce

- Plain-language privacy notice for families and school; a student-friendly "What the game keeps" screen.
- Data inventory and data flow summary (28.3).
- Accessibility conformance report (ACR) and an accessibility statement.
- Security notes (28.4) and a content policy (28.5).
- A teacher guide covering settings, consent for recordings and prizes, and how to export or delete data.
