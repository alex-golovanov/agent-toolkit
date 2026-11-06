# Three layers of a style profile

| Layer                | Produced by                              | Artifact                | Verification                                 |
| -------------------- | ---------------------------------------- | ----------------------- | -------------------------------------------- |
| A: measured features | `style.py metrics`                       | `<author>-metrics.json` | Recompute; compare a draft with `check`      |
| B: voice map         | Agent reading the corpus                 | `<author>-style.md`     | Evidence and confidence for each observation |
| C: writing rules     | Agent deriving instructions from A and B | Same Markdown profile   | Review the resulting writing                 |

Measurements are reproducible under the same analyzer version. They are not objective definitions of
an author's voice. Counts per 1,000 words normalize frequency, but short texts, genre, and topic
still affect comparability.

Use **high** confidence for a recurring pattern across most texts, **medium** for a pattern in a
meaningful subset, and **low** for isolated or ambiguous evidence. Quote only short passages needed
to demonstrate a technique. Avoid carrying private details into a reusable profile.

## Profile template

Replace the bracketed fields with evidence, or state that a trait was not observed.

```markdown
# [Author]: voice profile

Corpus: [source and genre], [text count and character count]. Excluded: [forwards, guest material,
short replies, or other exclusions]. Prepared: [date]. Analyzer: English schema 2, [plugin version].
Metrics: [relative path to author-metrics.json]. Limitations: [volume, genre, sample size,
unavailable grammar metrics].

## Voice map — layer B

### Register

- Formality: [observation]. Evidence: [measurement or example]. Confidence: [level].
- Reader distance and changes of register: [observation, evidence, confidence].

### Persona and attitude

- Speaking position, certainty, emotion, and humor: [observations with evidence].

### Rhetoric

- How claims are supported and how readers are addressed: [evidence-based observations].
- Recurring sequence of rhetorical moves: [observation, evidence, confidence].

### Composition

- Openings, paragraph structure, endings, and repeated rituals: [evidence].

## Writing rules — layer C

### Do

- [Concrete instruction derived from the voice map or measurements.]

### Avoid

- [Specific construction, tone, or formatting inconsistent with this corpus.]

### Typical structure

[Opening move] → [development] → [ending]. Adapt to the requested content.

### Numerical guidance

[Sentence and paragraph lengths, marker frequencies, punctuation, and their ranges.] Use the
companion metrics file for complete values. Do not invent missing values.

## Content leakage

[Topics, names, references, jokes, or examples that depend on this corpus and should not be
transferred to unrelated writing.]
```

## Method and references

Function words and structural measurements are useful descriptive features, but the English marker
lexicon in this port is curated and has not been calibrated against a representative English corpus.
The original Russian calibration is not transferable evidence. See the
[plugin README](../../README.md) for limits.

- [Troiano et al., hierarchical survey of style and style transfer](https://www.cambridge.org/core/journals/natural-language-engineering/article/from-theories-on-styles-to-their-transfer-in-text-bridging-the-gap-with-a-hierarchical-survey/C2C386DEEB83B6281280ACD899AA1A3F):
  motivates distinguishing levels of style and keeping content leakage visible.
- [Jin et al., Deep Learning for Text Style Transfer: A Survey](https://arxiv.org/abs/2011.00416):
  discusses style transfer as controlled text generation.
- [A Survey on Representing Linguistic Style](https://openreview.net/pdf/4d8862ca474d173a3753a4cec2566124ae57495e.pdf):
  included in the upstream bibliography for interpretable style representations.
- [Analyzing Writing Styles of Bloggers with Different Opinions](https://pweb.fbe.hku.hk/~mchau/papers/Blog_WITS2009.pdf):
  included in the upstream bibliography for applied blog stylometry.

The upstream project credits Anton Vdovichenko's
[style-portrait prompt](https://gist.github.com/miolamio/5224e81663f5140107d60132c2f61db2) as an
initial influence. This port preserves the separation of measured features, interpretation, and
writing instructions rather than treating a prompt as a measurement instrument. These references
motivate the method; they do not validate this implementation or its thresholds.
