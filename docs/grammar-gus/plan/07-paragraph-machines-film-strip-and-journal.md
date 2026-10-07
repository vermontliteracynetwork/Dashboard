# 7. Paragraph machines, film strip and Journal

## 7.1 Saving and sealing a sentence

- **Save (stamp button)** is available when the sentence has run, earned 3 stars (section 3.18), and is still unchanged; 1 and 2 star attempts can be kept as Tries. The machine plays a satisfying "sealed" animation and shrinks into a **Sentence Machine card** on the film strip with a poster frame from its video.
- A fresh, empty starter machine appears next to it. It deliberately **looks separate**: a different body color and a different housing set from a rotating palette (or the student's chosen skin), and it sits on its own platform, with its own pipe going to the same screen.
- Sealed machines stay editable: tap to reopen on the Workbench, change parts, run again, and re-seal. Editing creates a new version; the previous one is kept in the Journal history.
- Reorder sealed machines on the film strip by dragging; delete with the recycle chute (7-day undo).

## 7.2 Paragraph Line and Film Strip

- Up to 8 sentence machines per paragraph machine (4 in the MVP). They are shown stacked (tablet) or in a scroll list, each a miniature contraption; the active one is full size.
- The **Film Strip** under the screen shows the poster frames in order. Tapping a frame plays that scene; **Play All** plays the whole paragraph with pixel dissolves between scenes and continuity.
- The **Cast panel** shows all characters across the paragraph. A cast member can be tapped to hear its name and see the sentences it appears in.
- **Captions** are one line of large Lexend text with karaoke-style highlighting; a transcript of the whole paragraph is shown below the strip.
- Teacher or student can name the paragraph from title tiles (adjective plus noun) or the teacher can type it.

## 7.3 Expanding a sentence into a paragraph, in practice

> Example flow: the student builds "The white cat ran quickly." (WHO: the, white, cat; WHAT THEY DID: ran; HOW THEY DID IT: quickly), watches the video, saves. A new machine appears. They build "The black cat attacked the white cat." The second machine's WHAT IT HAPPENED TO housing holds the white cat part, whose white-cat sprite resolves to the same cast member from sentence 1. Play All shows the white cat running, the pixel dissolve, then the black cat pouncing on the same white cat.

## 7.4 Journal entries become machines and videos

- **Sentence entry:** machine layout JSON, scene script, poster frame, caption text, tense, silly score, source (Free build, Surprise Hopper, Order), versions.
- **Paragraph entry (Story):** list of sentence entries in order, the cast list, the combined script, a poster frame, title, collection tags.
- **Video:** playback is always from the script. A Make a video button renders an actual video file (WebM, MP4 where the browser supports it) and stores it with the entry (section 7.5). Entries show the poster frame; tapping plays.
- **Actions:** play, open the machine on the Workbench (as a copy or as a new version), remix, favorite, add to collection, record a voice note, make a printable storybook PDF (one page per sentence: poster frame, sentence in large type with grammar symbols above the words), delete to recycle bin.
- Teacher dashboard additions: stories per week, average sentences per paragraph, parts of speech used, verbs and adverbs used, which housings, sentences the machine fizzled on and what hint resolved them (for instruction).

## 7.5 Video export (technical)

- The Pixel Cinema renders to a low-resolution Canvas 2D element (160 x 90) that is upscaled by an integer factor. For export, capture it with `canvas.captureStream(30)` and `MediaRecorder`, rendering the script in real time or faster than real time with a fixed timestep. Pick the supported mimeType at runtime (video/webm;codecs=vp9, vp8, or video/mp4 on Safari).
- Audio: sound effects are generated with Web Audio and can be mixed into the capture via an audio destination node. Browser text to speech cannot be captured; the exported video has sound effects and captions, plus the student's recorded voice note if there is one.
- Fallback: if MediaRecorder is missing, the in-app script player is used and the Make a video button explains in one friendly line that videos play inside the game.
- Storage: scripts are about a few KB. Videos are cached in IndexedDB as blobs (cap about 20 MB each, 300 MB total) and can be regenerated from scripts at any time. When space runs low, Gus asks which videos to keep; scripts and posters are never deleted.

## 7.6 Data model additions

```
interface SentenceEntry { id; studentId; createdAt; version: number; machine: SentenceMachine;
                          script: SceneScript; text: string; poster: Blob; silly: number; rubric: RubricResult; stars: 3;
                          source: 'free'|'hopper'|'order'; videoId?: string; audioId?: string; }
interface StoryEntry    { id; studentId; createdAt; title: string; sentenceIds: string[]; cast: CastMember[];
                          script: SceneScript; poster: Blob; videoId?: string; collectionIds: string[]; }
interface VideoBlob     { id; mime: string; bytes: Blob; fromScriptHash: string; }
```
