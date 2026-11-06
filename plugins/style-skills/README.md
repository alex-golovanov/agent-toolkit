# Style Skills — English

Build a profile from an author's English texts, then draft or revise against it. The profile
separates reproducible measurements from an agent's interpretation of voice and the rules used to
write new text.

| Skill                                                | Task                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| [style-portrait](skills/style-portrait/SKILL.md)     | Measure a corpus and create an evidence-based voice profile |
| [writing-in-style](skills/writing-in-style/SKILL.md) | Apply an existing profile and check the resulting draft     |

This is an English adaptation of Vyacheslav Startsev's Style Skills 1.2.0. The port has its own
version, 0.1.0, and metrics schema, 2. It does not accept upstream Russian profiles. See
[provenance](../../THIRD_PARTY.md) for the exact source revision.

## From braindump to finished prose

The braindump supplies the content. A portrait supplies guidance about voice. The agent does the
writing, and the Python helper measures selected features of the result.

For a new piece, ask the agent to organize the notes into an outline, draft from the supplied facts,
apply your portrait if available, and review the result. Keep uncertain transcription separate from
verified details. A style pass cannot supply missing evidence or resolve an ambiguous product name.

For example, these **fictional** notes:

> Plant sensor kept alerting after watering. Checked every minute. Soil takes time to settle. Waited
> half an hour before checking again. Fewer repeated alerts. Only tried the kitchen pot.

could become:

> Waiting half an hour after watering reduced the plant sensor's repeated alerts. Checking every
> minute had caught the soil before the moisture settled. The longer interval worked for the kitchen
> pot; the other plants still need testing.

The agent has reorganized the argument and removed repetition. No style portrait is needed for that
basic cleanup. A portrait adds a more specific brief: how this author opens, explains a mechanism,
uses personal reactions, and qualifies a conclusion.

### First-time setup and everyday use

| When                           | Action                                                            | Result                                                          |
| ------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Once you have suitable samples | Ask `style-portrait` to read finished writing in the target genre | A metrics JSON file and a Markdown voice map with writing rules |
| For each piece                 | Give the agent your notes, audience, purpose, and required facts  | An outline and draft                                            |
| When voice matching matters    | Ask `writing-in-style` to apply both profile files                | A revised draft and advisory comparison                         |
| Before sharing                 | Review factual accuracy, missing context, readability, and voice  | Your editorial decision                                         |

A profile is reusable context, not model training. You can also apply it to an existing draft. Use
the [drafting request](../../docs/prompts/braindump-to-prose.md),
[portrait request](../../docs/prompts/build-voice-profile.md), and
[revision request](../../docs/prompts/apply-voice-profile.md) as starting points. The illustrated
[walkthrough](../../docs/style-workflow.html) has a longer prepared example;
[serve it locally](../../docs/serving.md) to read it in a browser.

Choose writing you would want the next piece to resemble. Remove other authors' passages and quoted
prompts. Separate the test input from the profile samples: if testing an older braindump, exclude
its finished article so the profile does not contain the answer. Record agent-assisted editing when
that is part of the sample history.

The two skills cover profiling and writing with a profile. Organizing raw notes uses the agent's
ordinary writing ability; no separate braindump plugin is required for this workflow. There is no
automatic end-to-end publishing system here.

## Run the local analyzer

Python 3.11 or newer is sufficient. From the repository root:

```bash
S=plugins/style-skills/skills/style-portrait
mkdir -p local/profiles
python3 "$S/style.py" corpus articles/ -o local/corpus.md --min-chars 200
python3 "$S/style.py" metrics local/corpus.md \
  --json local/profiles/author-metrics.json --ngrams 25 --openers 10
```

Ask the agent to use `style-portrait` to read the corpus and write `local/profiles/author-style.md`.
The script calculates measurements; it cannot write the interpretive voice map by itself. Then ask
`writing-in-style` to draft from supplied facts using that profile, and run:

```bash
python3 "$S/style.py" check local/profiles/author-metrics.json local/draft.md
```

In Claude plugin mode, use `S="${CLAUDE_PLUGIN_ROOT}/skills/style-portrait"` inside the agent's
execution context. That environment variable is not normally set in a human's terminal. For
standalone skill use, copy both skill folders as siblings and resolve `style.py` from the installed
`style-portrait` directory. The [root README](../../README.md) describes plugin installation.

## Corpus inputs

- A directory of `.md` or `.txt` files: one file per text, including a directory with only one file.
  Initial YAML frontmatter is stripped.
- A single flat file: posts separated by `---`, `***`, `===`, `___`, or at least two blank lines.
  One blank line separates paragraphs within a post.
- A single Telegram Desktop chat export:
  `python3 "$S/style.py" corpus --telegram export.json -o local/corpus.md`. Forwarded and service
  messages are excluded by default. `--keep-forwards` explicitly includes forwards. Multiple-chat
  exports are rejected.

The assembled corpus uses `###` followed by a space as reserved text boundaries. Ordinary
third-level headings in source content must be changed before assembly; this format does not
distinguish a post header from an article's third-level subheading. Verify author selection
independently: a Telegram message without a forward attribute can still be someone else's words,
especially in a group chat.

## What is measured

- Geometry: sentence and paragraph lengths, short and long sentence shares, and sentence-length
  variation relative to the mean (burstiness).
- Lexicon: type-token ratio, sampled moving-window TTR, hapax share, word length, numeric
  expressions, and unambiguous surface contractions.
- Markers per 1,000 words: first-person singular/plural, second-person pronouns, conversational
  markers, discourse markers, hedges, boosters, obligation, and formal bureaucratic phrases.
- Punctuation and formatting: dashes, questions, exclamations, quotation marks, emoji code points,
  list items, headings, links, and bold markup.
- Per-text p10, median, and p90 bands when enough texts qualify.

Contractions remain single tokens and curly apostrophes are normalized for lexical analysis. The
contraction frequency excludes `'s` because it can be possessive. English `you` is not assigned an
invented singular/plural distinction. Latin-word frequency, useful as a borrowing signal in Russian,
is removed from the English profile. N-grams never cross text boundaries.

Grammar, parts of speech, tense, and lemmatization are **not computed**. Installing Russian
morphology packages does not change this analyzer's output.

## Interpret checks carefully

`check` compares a draft with the author's p10–p90 bands where present. Otherwise it uses the
upstream heuristic tolerances around corpus averages. These are not statistical confidence
intervals. Sparse rates are skipped when the expected count is below `--min-expected` (default 1.5);
a new feature can still be flagged when it is absent or rare in the profile.

The two corpus thresholds are independent:

- Below 20,000 characters, `corpus` warns about a provisional portrait.
- Fewer than eight texts with at least 80 words means no comparison bands.

Drafts under 120 words receive a warning. `mattr_500` falls back to raw TTR below 500 tokens; above
that length it samples 500-token windows every 100 tokens, following the upstream method. It is not
an exhaustive all-window MATTR.

Sentence splitting joins soft-wrapped prose and keeps blank paragraphs, Markdown headings, and
explicit list items separate. Use bullets or blank lines for unpunctuated lists; plain newlines are
interpreted as wrapping. Common titles, initials, quoted sentence endings, and decimals are handled
heuristically. Abbreviations remain ambiguous. Marker lists are curated surface patterns; words such
as “must” or “well” can have different functions in context. Emoji counts measure matching code
points, not visible grapheme clusters. Review the source and the whole draft alongside the numbers.

No English authorship or voice-quality calibration is claimed. The upstream Russian corpus results
are not reproduced as English evidence. Tests establish software behavior, not literary quality or
attribution accuracy.

## Exit codes and profiles

| Exit | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| `0`  | Command completed; `check` is advisory unless `--strict` is supplied       |
| `1`  | `check --strict` found measured deviations                                 |
| `2`  | Invalid input, unreadable file, incompatible profile, or invalid arguments |

Profiles declare `meta.language: "en"` and `meta.schema_version: 2`. This tag records the selected
analyzer, not language detection. Rebuild profiles from English source texts rather than relabeling
Russian or schema-1 JSON. Profiles measured before the Markdown wrapping fix should also be rebuilt
from their sources if those sources contained hard-wrapped prose; the schema is unchanged.

## Privacy and attribution

The analyzer reads local files and writes only requested outputs. It makes no network calls. An
agent reading those files uses its own configured model and privacy settings; this is not a
guarantee that an agent keeps the corpus offline. Keep personal writing and generated profiles
outside public version control.

Original work: Vyacheslav Startsev. English adaptation: Alex Golovanov. The original
[MIT license](LICENSE) is included in this plugin directory so its notice travels with an
independently copied plugin.
