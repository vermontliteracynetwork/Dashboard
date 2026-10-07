# 9. The Golden Gear Contest (enter a 3-star sentence, win a $5 prize)

## 9.1 What it is

When a sentence earns 3 stars the student can **enter it in the Golden Gear Contest**. It is not a real contest against other students: it is just that student and the game's judges, which are really the rubric from section 3.18. The system collects the student's entries, picks the highest-ranking one that is genuinely proficient, and delivers the result as a fun machine-themed **mail delivery**: a pop-up the next time they log in, or a notification in their dashboard mail within 2 to 10 minutes if they are still in the dashboard but have left Grammar Gus. A winning entry earns a **$5 Golden Gear Prize** (a reward ticket the teacher fulfills; the app never handles money, section 9.7).

- **Optional and private:** students choose whether to enter. There is no leaderboard and no comparison with classmates.
- **Transparent rules:** the contest rules are shown in kid language on the Contest Desk, and the outcome is always decided by the rubric score and the written rules, never by chance. The delay before the mail arrives is only for anticipation; it does not change the result.
- **Never interrupts building:** no pop-up ever appears while the student is inside Grammar Gus (section 9.5).
- **Same engine:** contest scoring reuses the rubric (3.18), the Story rubric (3.18.9), the checklist and the Journal data. Nothing new has to be judged by hand.

## 9.2 What can be entered and who is eligible

| Rule | Sentence entry | Story entry (a small paragraph of 2 to 6 sentences) |
|---|---|---|
| Stars | The sentence has 3 stars (section 3.18) | Every sentence in it has 3 stars and is sealed |
| Cohesion | Not applicable | The Story rubric is at least 2 stars (same time throughout, or marked on purpose). 3 stars (characters connect) scores higher. |
| Built by the student | At least 60% of the parts were placed by the student. Surprise Hopper and Gus's Orders fills count as automatic. If under 60%: "Change a few more parts to make it yours." | Same rule across all sentences |
| Not a repeat | Not the same sentence (ignoring capitals and punctuation) as one that already won in the last 30 days; near copies (same pattern, 80% or more of the same words) count as repeats for 14 days | Same rule applied to the whole story and to each sentence |
| Entry limit | At most 5 entries per judging round | Counts as one entry |
| Prize limit | 1 prize per day and 3 per week by default (teacher can change). Beyond the limit an entry is still judged and can go to the Hall of Fame, but there is no prize; the Contest Desk says so before the student enters. | Same |
| Overlap | A sentence that is part of an entered story cannot also win on its own in the same round |  |

## 9.3 Entering: the Contest Desk

- After a 3-star video ends, the buttons are **Seal into my story**, **Enter the Golden Gear Contest** and **Skip**. A finished Story gets the same Enter button on the Factory view.
- The **Contest Desk** is a small machine-themed panel that shows three green gears: 3 stars, built by you, new sentence. If a check is not green it says why in one kind sentence and what to change. A fourth line shows whether a prize is still possible today.
- **Enter** plays a short animation: the sentence is rolled up in a capsule and shot into a brass pneumatic tube toward the Gizmo Gala Hall. The student sees "On its way to the judges! Watch your mail." The entry can be pulled back (Undo) until judging starts.
- Entering is one tap; no typing. A student who ignores the button loses nothing.

```
+--------------------- Gizmo Gala Contest Desk ---------------------+
|  Your sentence:  "The tiny zebra drank loudly."      [speaker]      |
|  [gear*] 3 stars     [gear*] You built it     [gear*] It is new     |
|  Today's Golden Gear prize: still open                              |
|                                                                     |
|        [ Shoot it into the tube! ]        [ Not now ]               |
+---------------------------------------------------------------------+
```

## 9.4 Judging rounds and the contest score

A **round** opens with a student's first entry and closes when its judging time arrives: **judgeAt = first entry time + 2 minutes + a seeded random 0 to 8 minutes** (so 2 to 10 minutes). Any further entries made before judgeAt join the round. At judgeAt, the system scores every entry, picks the highest one, applies the rules and produces one result. Judging happens in the background; the student is never asked to wait.

> Contest score (0 to 100) for a sentence entry:

| Part | Points | How it is earned |
|---|---|---|
| Accuracy | 40 | Full marks for a 3-star sentence (rubric 100 of 100) |
| Detail and variety | 25 | 5 points for each different feature used: describing word, how word, where phrase, join word, a starter (opening how word or a shout) |
| Length and build | 10 | 6 to 8 words = 5; 9 or more words = 10 |
| Silly | 10 | Silly meter 0 to 5, 2 points each (the contest celebrates silly) |
| Independence | 10 | Grammar Help level: Full help 0, Guided 5, Challenge 10 |
| Clean build | 5 | No Fix it used while building this sentence |

> Contest score (0 to 100) for a story entry:

| Part | Points | How it is earned |
|---|---|---|
| Accuracy | 25 | All sentences are 3 stars |
| Cohesion | 25 | Same time throughout 8, characters connect 10, a then the 4, pronouns have someone to point to 3 |
| Detail and variety | 15 | 3 points for each different feature used across the story (up to 5) |
| Length | 10 | 2 sentences = 4, 3 = 6, 4 = 8, 5 or 6 = 10 |
| Silly | 10 | Average silly meter x 2 |
| Independence | 10 | Average of the Grammar Help points |
| Clean build | 5 | Share of sentences built without Fix it |

- **Winner:** the entry with the highest contest score. Ties: higher accuracy, then higher independence, then the earlier entry.
- **Proficiency bar (teacher setting):** default is **any 3-star entry** (a story must also have Story rubric of 2 stars or more). The teacher can raise it to "3 stars and contest score of at least 60" or "at least 75" so that a plain sentence like "The cat ran." is considered but does not win a prize. The plan recommends raising it after the first weeks.
- **Result outcomes:** prize (winner meets the bar and no limit is hit), no prize (winner under the raised bar), limit reached (prize already given today or this week), repeat (see 9.2). Each outcome has its own message (9.6).
- Worked example: "The tiny zebra drank loudly." = 40 accuracy + describer, how word = 10 + 5 length + silly 4 = 8 + Guided 5 + clean 5 = 73. A 4-sentence cohesive story at Guided can score about 85 to 95 and will outrank single sentences in the same round.

## 9.5 When the result arrives (presence-based delivery)

| Where the student is at judgeAt | What happens | Never |
|---|---|---|
| Inside Grammar Gus (building, watching, journal) | Hold the result. Deliver when they leave Grammar Gus for the dashboard (but not before judgeAt). A small mail icon on the Back button shows a dot meanwhile. If they stay inside for more than 30 minutes the result goes to the mailbox quietly with only the dot. | No pop-up inside Grammar Gus |
| Elsewhere in the dashboard and active | Deliver at judgeAt: a pneumatic-tube toast ("A tube just arrived!") and a message in the dashboard mailbox with an unread dot. | No sound unless the dashboard sound setting is on |
| Dashboard open but idle | Deliver at judgeAt to the mailbox; the toast shows when the student is active again. |  |
| Logged out or session ended | At the next login, **first thing**: a full-screen Telegram scene (the capsule pops open) with the result. It shows once, then lives in the mailbox. | Never repeat the pop-up |
| Result already seen | Stays in the mailbox for 30 days; the student can replay the winning video and see the prize status anytime ("come back to it"). |  |

- **Why 2 to 10 minutes:** it gives time to leave Grammar Gus and builds a little anticipation without making the student wait long. The delay is seeded per round so it is reproducible and testable.
- **Skip and sensory settings:** every pop-up has Skip and Later; calm mode removes motion and confetti; sound follows the sound setting; no flashing.
- **Reminder:** an unread result is shown as a dot on the dashboard mail icon until opened; no nagging notifications and no repeated pop-ups.

## 9.6 The result experience (machine themed)

- **The tube:** a brass pneumatic tube capsule drops into the dashboard mailbox with a soft thunk.
- **The judges (flavor):** three silly judge machines at the Gizmo Gala Hall give short lines: Judge Sprocket (tidy robot with a gauge monocle), Madame Steam (a whistling kettle) and Captain Cog (a big gear with a mustache). They are characters only; the real decision is the rubric and contest score, which the screen shows as a plain breakdown.
- **Winner scene:** the Pixel Cinema opens its red curtains on a golden podium; a golden gear trophy descends; Gus and the judges clap in pixel style (a few frames, no flashing). Then the winning video plays (a story plays with Play All, 10 seconds per sentence), followed by a card: "Winner of the Golden Gear: [the sentence]" with a score breakdown in kid words (what made it strong, one thing to try next).
- **Prize card:** "$5 Golden Gear Prize" with a status chip: Waiting for your teacher, Ready to collect, or Collected. The student also gets a non-money keepsake: a golden gear trophy for the Journal Hall of Fame and a closet item.
- **Hall of Fame:** a Journal shelf (section 20) holds every winner with its video and golden gear badge.

| Non-winner outcome | Gentle mode (default) | Plain mode | Silent mode |
|---|---|---|---|
| Winner under a raised bar | "The judges read your entry. It did not win this time. To get a prize, try adding a describing word or a where phrase." | "No prize this time." | No message; the entry shows "Entered" in the Contest Desk |
| Prize limit reached | "You already won today's Golden Gear! This one goes in the Hall of Fame." | "Today's prize is already given." | As above |
| Repeat sentence | "You won with this one already. Try a new sentence!" | "This sentence was a winner before." | As above |
| Story not cohesive enough | "Your sentences are good! Make them about the same character to make a story." | "Not a story yet." | As above |

> The teacher chooses Gentle, Plain or Silent for each student. Plan default is Gentle because it is honest and kind; Silent suits students who are sensitive to not winning. The messages never say "you lost" and always include one concrete next step.

## 9.7 The $5 reward

- **What the app does:** when a winning result meets the rules, the app creates a **reward ticket** worth $5.00 and notifies the teacher. It records the ticket, status and history. **The app never moves, stores or processes money.**
- **What the $5 is:** the plan treats it as a teacher-fulfilled prize. Whether it is cash, a gift card, classroom bucks or a privilege is the teacher's and school's decision (section 34). The ticket has a `kind` field so the dashboard's existing reward system can map it.
- **Status flow:** earned, pending approval, approved, fulfilled (or declined with a reason). The student sees kid wording: Waiting for your teacher, Ready to collect, Collected. Teacher approval is required by default and can be set to automatic.
- **Budget controls:** per-student daily and weekly limits, a monthly class budget cap, and a teacher alert when the cap is near. When the budget is spent, wins still happen (trophy, Hall of Fame) but the ticket says "No prize budget left" to the teacher only; the student sees the Hall of Fame win.
- **Anti-farming:** only student-built sentences count (60% rule), repeats do not win, one prize per day by default, entries per round are capped, and trivial one-word-swaps are treated as repeats. Hopper-generated sentences are never prize-eligible by themselves.
- **Responsible design:** check school and family policy before offering cash or gift cards; the contest is opt-in, there is no loss, no streak pressure, no random prizes and no public ranking. Rules are visible to the student, and the teacher can turn the prize off while keeping the contest, trophy and mail as pure recognition.

| Ticket status | Teacher sees | Student sees |
|---|---|---|
| earned | New ticket with the sentence, video, score breakdown and amount | Waiting for your teacher |
| approved | Approve button used; fulfillment checklist | Ready to collect! |
| fulfilled | Marked given with date and note | Collected (with a gold gear) |
| declined | Reason required | A kind note from the teacher (teacher writes it) or silent |

## 9.8 Integration with the dashboard (Grammar Gus is a game inside it)

```
interface DashboardBridge {
  presence(studentId: string): 'grammarGus' | 'dashboard' | 'idle' | 'offline';
  onPresenceChange(cb: (p: Presence) => void): Unsubscribe;
  mailbox: { push(m: MailMessage): Promise<string>; list(studentId: string): Promise<MailMessage[]>;
             markRead(id: string): Promise<void>; };
  popups: { showTelegram(studentId: string, resultId: string): Promise<void>;   // first-login scene
            toast(studentId: string, text: string, openResultId: string): void; };
  rewards: { createTicket(t: RewardTicket): Promise<string>; };               // teacher-side ledger
  teacher: { notify(text: string, link: string): Promise<void>; };
  clock: { now(): number; schoolDay(): string; };
}
```

- **Fallback (no dashboard services):** a `LocalBridge` keeps the mailbox and tickets in IndexedDB, detects presence from the route and page visibility with a heartbeat in localStorage (BroadcastChannel for other tabs), and runs the delivery timers with persisted `notifyAt` times that are re-checked on every load, so a result is never lost when the page closes.
- The Grammar Gus component never talks to the dashboard directly; it calls only the bridge, so the real dashboard can plug in later.
- Time uses the school day boundary (configurable) for the daily and weekly limits.

## 9.9 Teacher settings and dashboard

| Setting | Options (default first) |
|---|---|
| Contest on or off per student | On / Off |
| Prize on or off | On / Off (off keeps trophy, Hall of Fame and mail) |
| Prize amount and kind | $5.00 / custom amount; cash, gift card, classroom bucks, privilege, other |
| Proficiency bar | Any 3-star / 3-star and score 60 / 3-star and score 75 |
| Prize limits | 1 per day and 3 per week / custom; monthly class budget cap |
| Approval | Teacher approves each prize / automatic |
| Non-winner messages | Gentle / Plain / Silent |
| Delivery delay window | 2 to 10 minutes / custom (1 to 30) |
| Built-by-student threshold | 60% / custom |
| Repeat cool-down | 30 days exact, 14 days near copies / custom |

- **Contest ledger** for the teacher: every entry with sentence, video, rubric and contest score breakdown, outcome, ticket status, dates; filters by student and week; export to CSV or PDF; one-click approve or fulfill.
- **Insights:** entries per week, win rate, which rubric parts students are weakest in (so the teacher can target instruction), most common non-winner reasons.

## 9.10 Data model, state machine and algorithm

```
type EntrySubject = { kind: 'sentence'; sentenceId: string } | { kind: 'story'; storyId: string };
interface ContestEntry  { id; studentId; subject: EntrySubject; submittedAt: number;
                          roundId: string; status: 'submitted'|'withdrawn'|'judged'; breakdown?: ScoreBreakdown; }
interface ContestRound  { id; studentId; openedAt: number; judgeAt: number; entryIds: string[];
                          resultId?: string; }
interface ContestResult { id; roundId; winnerEntryId?: string; score?: number; breakdown?: ScoreBreakdown;
                          outcome: 'prize'|'noPrize'|'limit'|'repeat'|'notCohesive'|'belowBar';
                          rewardTicketId?: string; deliveredAt?: number; seenAt?: number; }
interface RewardTicket  { id; studentId; resultId; amountCents: number /* 500 */; currency: 'USD';
                          kind: 'cash'|'giftCard'|'classroomBucks'|'privilege'|'other';
                          status: 'earned'|'approved'|'fulfilled'|'declined'; note?: string; }
interface MailMessage   { id; studentId; type: 'contestResult'|'rewardStatus'; resultId: string;
                          createdAt: number; readAt?: number; expiresAt: number; }

submitEntry(student, subject):
   check eligibility (stars, built-by-student, not a repeat, entry limit, prize limit warning)
   round = openRound(student) ?? new ContestRound(judgeAt = now + 120 s + seeded(0..480 s))
   round.entryIds.push(entry.id)

judgeRound(round):                                // runs at judgeAt (pure scoring + rules)
   scores = entries.map(contestScore); winner = argmax(scores, tiebreaks)
   outcome = rules(winner, bar, limits, repeats, storyCohesion)
   result = createResult(...); if outcome == 'prize': ticket = rewards.createTicket(...)
   scheduleDelivery(result)

deliver(result): by presence per section 9.5 (hold / toast + mail / first-login telegram)
```

## 9.11 Tests

- **Scoring fixtures:** sentences and stories with known contest scores for each profile; ties; the worked example; a story outranks a single sentence only when its score is higher.
- **Eligibility:** 1 or 2 star sentences cannot be entered; Hopper-only sentences are blocked; repeats and near copies are blocked for the right cool-down; the daily and weekly limits and the monthly budget cap; story needs Story rubric of 2 stars or more.
- **Rounds and timing:** judgeAt is between 2 and 10 minutes after the first entry; entries before judgeAt join the round; later entries start a new round; the seed makes it reproducible; timers survive reload and logout.
- **Delivery by presence:** no pop-up inside Grammar Gus; toast and mail when in the dashboard; first-login Telegram exactly once; results stay in the mailbox for 30 days; replay works; Silent, Plain and Gentle messages show the right copy.
- **Reward ticket:** a ticket is created only for outcome prize, with amount 500 cents; status transitions; teacher notification; no money code anywhere in the app (a lint check for payment APIs); budget cap behavior.
- **Accessibility and sensory:** every pop-up has Skip and Later; calm mode removes motion; text is Lexend and reads aloud; mail and Contest Desk are keyboard operable.
