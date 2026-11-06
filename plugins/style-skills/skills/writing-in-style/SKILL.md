---
name: writing-in-style
description: Draft or revise English text using an existing voice profile and companion metrics.
---

# Writing in style

Use `<author>-style.md` as the writing specification and `<author>-metrics.json` as an advisory
quantitative check. Locate the requested profile in the supplied materials or the project's
`profiles/` directory. Do not search unrelated personal directories. If no profile exists, explain
that limitation and offer to build one from a corpus with `style-portrait`.

A Markdown-only profile can guide writing without machine verification. Say that the numerical check
was unavailable; do not invent metrics.

## Draft or revise

1. Separate facts from form. Identify required claims, numbers, links, and the requested conclusion.
   Style does not authorize inventing facts.
2. Apply layer C's `do`, `avoid`, and typical structure. Treat the structure as a guide, not a
   requirement to manufacture missing content. Preserve the user's requested format and scope.
3. Use the measured sentence and paragraph ranges as guidance. Preserve meaning when a numerical
   target conflicts with clear, accurate writing.
4. Review each `avoid` instruction. Keep topics, names, jokes, and private details listed under
   **Content leakage** out of unrelated output.
5. Run the companion checker if available. Locate `style.py` in the sibling `style-portrait` skill.
   For a Claude plugin, bind `S` to `${CLAUDE_PLUGIN_ROOT}/skills/style-portrait`; otherwise resolve
   that sibling from the loaded skill directory and bind `S` to its actual path.

   ```bash
   python3 "$S/style.py" check profiles/author-metrics.json draft.md
   ```

6. Investigate features marked absent or rare in the profile, then large departures from the
   author's range. Revise the draft when the evidence supports it; do not tune thresholds merely to
   obtain a clean check.
7. Recheck after changes and deliver the full text with a brief verification note.

The checker accepts only English schema-2 profiles. If an older or Russian profile is rejected,
rebuild it from the appropriate English source corpus with the user's authorization. Do not relabel
its metadata to bypass the check.

## Editorial judgment

For a revision, preserve the supplied facts, numbers, links, and order of ideas unless the user
requests structural changes. Adjust sentence and paragraph length, transitions, punctuation,
formatting, direct address, and framing.

An optional generic prose cleanup belongs before the final voice pass. If an available editorial
tool is used afterward, use it diagnostically: generic bans on dashes, lists, or emoji must not
erase measured author traits. No external humanizer, detector, installation, or paid service is
required. Do not claim that the output is undetectable as AI-generated.

Under 120 words, comparison rates are noisy. A clean comparison is not proof of voice matching,
identity, originality, or writing quality. The port has no empirical English calibration. Review the
whole piece for meaning and voice.

Support the user's own or authorized brand voice. Do not fabricate quotations, endorsements, or
claims that another person authored the text. Transfer techniques, not distinctive source passages
or anecdotes.
