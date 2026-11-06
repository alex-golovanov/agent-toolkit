#!/usr/bin/env python3
"""Measure English writing style: corpus, metrics, and draft comparison.

Adapted from Vyacheslav Startsev's MIT-licensed Style Skills; see ../../LICENSE.
Uses only the Python standard library. Grammatical morphology is not computed.
"""

import argparse
import json
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

SCHEMA_VERSION = 2
LANGUAGE = "en"
WORD = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*", re.UNICODE)
URL = re.compile(r"https?://\S+")
EMOJI = re.compile("[\U0001f300-\U0001faff\U00002600-\U000027bf\U0001f1e6-\U0001f1ff]")
SENTENCE_END = re.compile(r"(?<=[.!?…])[\"'”’)]*\s+")
ABBREVIATION = re.compile(r"\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|e\.g|i\.e)\.", re.I)
FRONTMATTER = re.compile(r"\A---[ \t]*\n.*?\n---[ \t]*(?:\n|$)", re.S)
FLAT_RULE = re.compile(r"^[ \t]*(?:-{3,}|\*{3,}|={3,}|_{3,})[ \t]*$", re.M)
FLAT_BLANKS = re.compile(r"\n[ \t]*\n[ \t]*\n+")

# Curated surface markers, not grammatical labels or validated authorship features.
# English "you" does not reliably encode number, so it has one group.
GROUPS = {
    "pronouns_1sg": "I, me, my, mine, myself, I'm, I've, I'll, I'd",
    "pronouns_1pl": "we, us, our, ours, ourselves, we're, we've, we'll, we'd",
    "pronouns_2": "you, your, yours, yourself, yourselves, you're, you've, you'll, you'd",
    "conversational": "well, oh, yeah, yep, nope, okay, hey, you know, I mean",
    "discourse_markers": "however, therefore, for example, for instance, in other words, "
    "meanwhile, besides, nevertheless, on the other hand, as a result, in addition, "
    "by the way, in fact, finally, first, second",
    "hedges": "perhaps, maybe, probably, possibly, apparently, seems, seem, usually, "
    "generally, roughly, somewhat, kind of, sort of, I think, I suspect, in general",
    "boosters": "certainly, definitely, clearly, obviously, absolutely, undoubtedly, "
    "really, indeed, extremely, entirely, completely, always, never",
    "obligation": "must, should, ought to, have to, has to, need to, needs to, required to",
    "officialese": "pursuant to, in accordance with, with regard to, in the event that, "
    "for the purpose of, it should be noted, at this time, aforementioned, hereby, "
    "herein, shall, constitutes",
}
GROUP_PATTERNS = {
    name: re.compile(
        r"(?<![\w'-])(?:"
        + "|".join(
            re.escape(phrase.strip())
            for phrase in sorted(phrases.split(","), key=len, reverse=True)
        )
        + r")(?![\w'-])",
        re.I,
    )
    for name, phrases in GROUPS.items()
}
BAND_SECTIONS = ("geometry", "lexicon", "markers_per_1000", "punctuation_per_1000")
CHECK_KEYS = [
    ("geometry", "sentence_words_median", 0.25),
    ("geometry", "sentence_words_mean", 0.25),
    ("geometry", "burstiness", 0.30),
    ("geometry", "share_sentences_le7", 0.30),
    ("geometry", "share_sentences_ge25", 0.50),
    ("geometry", "paragraph_words_mean", 0.35),
    ("lexicon", "mattr_500", 0.15),
    ("lexicon", "word_length_mean", 0.15),
    ("lexicon", "numbers_per_1000", 0.50),
    ("lexicon", "contractions_per_1000", 0.50),
]


def normalize(text):
    return text.replace("’", "'")


def words(text):
    return WORD.findall(normalize(text))


def sentences(text):
    """Heuristic English boundaries; newlines delimit unpunctuated lists.

    Protect common title abbreviations, initials, and decimals. This is not a
    general syntactic parser; ambiguous abbreviations still need human review.
    """
    out = []
    for line in text.splitlines():
        protected = ABBREVIATION.sub(lambda m: m[0].replace(".", "\0"), line.strip())
        protected = re.sub(r"\b[A-Z]\.(?=\s+[A-Z])", lambda m: m[0][:-1] + "\0", protected)
        for part in SENTENCE_END.split(protected):
            if words(part):
                out.append(part.replace("\0", "."))
    return out


def strip_frontmatter(raw):
    return FRONTMATTER.sub("", raw, count=1)


def split_flat(raw):
    raw = strip_frontmatter(raw)
    parts = FLAT_RULE.split(raw) if FLAT_RULE.search(raw) else FLAT_BLANKS.split(raw)
    return [part.strip() for part in parts if part.strip()]


def split_corpus(raw):
    return [part.strip() for part in re.split(r"^### .*$", raw, flags=re.M) if part.strip()]


def tg_text(message):
    value = message.get("text", "")
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "".join(part if isinstance(part, str) else part.get("text", "") for part in value)
    return ""


def from_telegram(path, keep_forwards=False, min_chars=0):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if "chats" in data:
        chats = data["chats"]["list"]
        if len(chats) != 1:
            raise ValueError(
                "Export exactly one Telegram chat; multiple or empty chats are ambiguous."
            )
        data = chats[0]
    items, forwarded, empty = [], 0, 0
    messages = data.get("messages", [])
    for message in messages:
        if message.get("type") != "message":
            continue
        if message.get("forwarded_from") and not keep_forwards:
            forwarded += 1
            continue
        body = tg_text(message).strip()
        if not body or len(body) < min_chars:
            empty += 1
            continue
        items.append((str(message.get("id")), (message.get("date") or "")[:10], body))
    print(
        f"[i] {len(items)} texts; {forwarded} forwards removed; {empty} empty/short messages",
        file=sys.stderr,
    )
    return items


def from_files(paths, min_chars=0):
    items = []
    for source in paths:
        path = Path(source)
        files = sorted([*path.rglob("*.md"), *path.rglob("*.txt")]) if path.is_dir() else [path]
        for file in files:
            raw = strip_frontmatter(file.read_text(encoding="utf-8")).strip()
            # A directory preserves one file per text, even when it contains just one file.
            if not path.is_dir() and len(paths) == 1:
                chunks = split_corpus(raw) if re.search(r"^### ", raw, re.M) else split_flat(raw)
                if len(chunks) == 1 and len(raw) > 20000:
                    print(
                        "[!] No post boundaries found: this file counts as one text.",
                        file=sys.stderr,
                    )
            else:
                chunks = [raw]
            for index, body in enumerate(chunks, 1):
                if body and len(body) >= min_chars:
                    items.append((f"{file.stem}-{index}", "", body))
    return items


def cmd_corpus(args):
    if bool(args.telegram) == bool(args.paths):
        raise ValueError("Provide either file paths or --telegram, but not both.")
    if args.min_chars < 0:
        raise ValueError("--min-chars must be nonnegative.")
    items = (
        from_telegram(args.telegram, args.keep_forwards, args.min_chars)
        if args.telegram
        else from_files(args.paths, args.min_chars)
    )
    if not items:
        raise ValueError("The corpus is empty; there is nothing to analyze.")
    # Numeric IDs prevent filenames from becoming corpus content or metadata.
    content = "\n\n".join(f"### {index}\n{body}" for index, (_, _, body) in enumerate(items, 1))
    Path(args.out).write_text(content + "\n", encoding="utf-8")
    chars = sum(len(body) for _, _, body in items)
    print(f"[i] {len(items)} texts, {chars} characters written to {args.out}", file=sys.stderr)
    if chars < 20000:
        print(
            "[!] Corpus under 20,000 characters: treat the portrait as provisional.",
            file=sys.stderr,
        )
    return 0


def per1000(count, total):
    return round(1000 * count / total, 2) if total else 0.0


def mattr(tokens, window):
    """Sample windows every window/5 tokens, as upstream; short inputs use raw TTR."""
    if window < 1:
        raise ValueError("The MATTR window must be positive.")
    if len(tokens) < window:
        return round(len(set(tokens)) / len(tokens), 3) if tokens else 0
    values = [
        len(set(tokens[i : i + window])) / window
        for i in range(0, len(tokens) - window + 1, max(1, window // 5))
    ]
    return round(statistics.mean(values), 3)


def analyze(texts):
    if not texts or not any(words(URL.sub(" ", text)) for text in texts):
        raise ValueError("The corpus must contain words.")
    body = "\n\n".join(texts)
    clean = normalize(URL.sub(" ", body))
    tokens = [word.lower() for word in words(clean)]
    total = len(tokens)
    sents = [sentence for text in texts for sentence in sentences(URL.sub(" ", text))]
    lengths = [len(words(sentence)) for sentence in sents]
    paragraphs = [p for text in texts for p in re.split(r"\n\s*\n", text) if p.strip()]
    paragraph_lengths = [len(words(URL.sub(" ", paragraph))) for paragraph in paragraphs]
    text_lengths = [len(text) for text in texts]
    mean = statistics.mean(lengths)
    sd = statistics.pstdev(lengths)
    # Possessives are ambiguous: 's is excluded from contraction counts.
    contractions = sum(bool(re.search(r"(?:n't|'re|'ve|'ll|'d|'m)$", token)) for token in tokens)
    return {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "language": LANGUAGE,
            "texts": len(texts),
            "chars": sum(text_lengths),
            "words": total,
            "sentences": len(sents),
            "morphology": False,
        },
        "geometry": {
            "text_chars_median": int(statistics.median(text_lengths)),
            "text_chars_mean": int(statistics.mean(text_lengths)),
            "sentence_words_mean": round(mean, 1),
            "sentence_words_median": statistics.median(lengths),
            "sentence_words_sd": round(sd, 1),
            "burstiness": round(sd / mean, 2) if mean else 0,
            "share_sentences_le7": round(sum(n <= 7 for n in lengths) / len(lengths), 2),
            "share_sentences_8_24": round(sum(8 <= n <= 24 for n in lengths) / len(lengths), 2),
            "share_sentences_ge25": round(sum(n >= 25 for n in lengths) / len(lengths), 2),
            "paragraph_words_mean": round(statistics.mean(paragraph_lengths), 1),
            "paragraph_sentences_mean": round(len(sents) / len(paragraphs), 1),
        },
        "lexicon": {
            "ttr_raw": round(len(set(tokens)) / total, 3),
            "mattr_500": mattr(tokens, 500),
            "hapax_share": round(
                sum(n == 1 for n in Counter(tokens).values()) / len(set(tokens)), 3
            ),
            "word_length_mean": round(statistics.mean(len(token) for token in tokens), 2),
            "numbers_per_1000": per1000(len(re.findall(r"\b\d[\d.,%]*", clean)), total),
            "contractions_per_1000": per1000(contractions, total),
        },
        "markers_per_1000": {
            name: per1000(len(pattern.findall(clean)), total)
            for name, pattern in GROUP_PATTERNS.items()
        },
        "punctuation_per_1000": {
            "em_dash": per1000(body.count("—"), total),
            "en_dash": per1000(len(re.findall(r"(?<=\s)–(?=\s)", body)), total),
            "hyphen_as_dash": per1000(len(re.findall(r"(?<=\s)-(?=\s)", body)), total),
            "ellipsis": per1000(len(re.findall(r"\.\.\.|…", body)), total),
            "parenthetical": per1000(len(re.findall(r"\([^)]{5,}\)", body)), total),
            "question": per1000(body.count("?"), total),
            "exclamation": per1000(body.count("!"), total),
            "colon": per1000(body.count(":"), total),
            "semicolon": per1000(body.count(";"), total),
            "quotes_straight": per1000(body.count('"'), total),
            "quotes_curly": per1000(body.count("“"), total),
            "emoji": per1000(len(EMOJI.findall(body)), total),
            "caps_words": per1000(len(re.findall(r"\b[A-Z]{4,}\b", body)), total),
        },
        "formatting_per_text": {
            "bullet_items": round(len(re.findall(r"^\s*[-•*]\s", body, re.M)) / len(texts), 2),
            "numbered_items": round(len(re.findall(r"^\s*\d+[.)]\s", body, re.M)) / len(texts), 2),
            "markdown_headings": round(len(re.findall(r"^#{1,6}\s", body, re.M)) / len(texts), 2),
            "links": round(len(URL.findall(body)) / len(texts), 2),
            "bold_italic": round(len(re.findall(r"\*\*[^*]+\*\*|__[^_]+__", body)) / len(texts), 2),
            "first_line_no_period": round(
                sum(not t.splitlines()[0].endswith(".") for t in texts if t.strip()) / len(texts), 2
            ),
            "first_line_chars": int(
                statistics.mean(len(t.splitlines()[0]) if t else 0 for t in texts)
            ),
        },
        "morphology": {
            "computed": False,
            "reason": "English grammatical analysis is not provided.",
        },
    }


def flatten(data, prefix=""):
    result = {}
    for key, value in data.items():
        path = prefix + key
        if isinstance(value, dict):
            result.update(flatten(value, path + " / "))
        else:
            result[path] = value
    return result


def bands(texts, min_words=80, min_texts=8):
    samples = [analyze([text]) for text in texts if len(words(URL.sub(" ", text))) >= min_words]
    diagnostic = {"total": len(texts), "used": len(samples), "need": min_texts}
    if len(samples) < min_texts:
        return {}, diagnostic
    result = {}
    for section in BAND_SECTIONS:
        result[section] = {}
        for key in samples[0][section]:
            values = sorted(sample[section][key] for sample in samples)
            result[section][key] = {
                label: round(values[int(fraction * (len(values) - 1))], 3)
                for label, fraction in (("p10", 0.1), ("median", 0.5), ("p90", 0.9))
            }
    result["_texts_used"] = len(samples)
    return result, diagnostic


def top_ngrams(texts, size, limit):
    if size < 1 or limit < 0:
        raise ValueError("N-gram size must be positive and limit nonnegative.")
    counts = Counter()
    for text in texts:
        tokens = [word.lower() for word in words(URL.sub(" ", text))]
        counts.update(" ".join(tokens[i : i + size]) for i in range(len(tokens) - size + 1))
    return [
        {"phrase": phrase, "count": count}
        for phrase, count in counts.most_common(limit)
        if count > 1
    ]


def top_openers(texts, limit):
    counts = Counter(
        " ".join(words(text.splitlines()[0])[:3]).lower() for text in texts if text.strip()
    )
    return [
        {"opener": opener, "count": count}
        for opener, count in counts.most_common(limit)
        if count > 1
    ]


def cmd_metrics(args):
    if args.ngrams < 0 or args.openers < 0 or args.ngram_size < 1:
        raise ValueError("Counts must be nonnegative and n-gram size must be positive.")
    texts = split_corpus(Path(args.corpus).read_text(encoding="utf-8"))
    result = analyze(texts)
    if not args.no_bands:
        result["bands"], diagnostic = bands(texts)
        if not result["bands"]:
            print(
                f"[!] No bands: {diagnostic['used']} texts with 80+ words; need 8. "
                "check will compare against corpus averages.",
                file=sys.stderr,
            )
    if args.ngrams:
        result["top_ngrams"] = top_ngrams(texts, args.ngram_size, args.ngrams)
    if args.openers:
        result["top_openers"] = top_openers(texts, args.openers)
    if args.json:
        Path(args.json).write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    for key, value in flatten(result).items():
        print(f"{key}: {value}")
    return 0


def validate_profile(profile):
    if not isinstance(profile, dict) or not isinstance(profile.get("meta"), dict):
        raise ValueError("Invalid profile: missing metadata.")
    if (
        profile["meta"].get("schema_version") != SCHEMA_VERSION
        or profile["meta"].get("language") != LANGUAGE
    ):
        raise ValueError(
            "Incompatible profile: rebuild an English schema-2 profile from the corpus."
        )
    for section in BAND_SECTIONS:
        if not isinstance(profile.get(section), dict) or not profile[section]:
            raise ValueError(f"Invalid profile: missing {section} metrics.")
    expected = analyze(["Example text."])
    for section in BAND_SECTIONS:
        for key in expected[section]:
            value = profile[section].get(key)
            if type(value) not in (float, int) or not 0 <= value < float("inf"):
                raise ValueError(f"Invalid profile metric: {section}.{key}")
    all_bands = profile.get("bands", {})
    if not isinstance(all_bands, dict):
        raise ValueError("Invalid profile bands.")
    for section in BAND_SECTIONS:
        if not isinstance(all_bands.get(section, {}), dict):
            raise ValueError(f"Invalid profile bands: {section}")
        for band in all_bands.get(section, {}).values():
            if not isinstance(band, dict):
                raise ValueError("Invalid profile band.")
            values = [band.get(key) for key in ("p10", "median", "p90")]
            if any(
                type(value) not in (float, int) or not 0 <= value < float("inf") for value in values
            ):
                raise ValueError("Invalid profile band values.")
            if values != sorted(values):
                raise ValueError("Invalid profile: bands must be ordered.")


def compare(profile, draft, min_expected=1.5):
    validate_profile(profile)
    if not 0 <= min_expected < float("inf"):
        raise ValueError("--min-expected must be finite and nonnegative.")
    got = analyze([draft])
    total = got["meta"]["words"]
    keys = CHECK_KEYS + [
        (section, key, 0.60)
        for section in ("markers_per_1000", "punctuation_per_1000")
        for key in got[section]
    ]
    rows, thin = [], 0
    for section, key, tolerance in keys:
        want, have = profile[section][key], got[section][key]
        band = profile.get("bands", {}).get(section, {}).get(key)
        lo, hi = (
            (band["p10"], band["p90"]) if band else (want * (1 - tolerance), want * (1 + tolerance))
        )
        baseline = band["p90"] if band else want
        sparse = "1000" in section or "1000" in key
        if sparse and baseline * total / 1000 < min_expected:
            if have > 0 and have > 2 * max(baseline, want):
                rows.append(
                    {
                        "key": key,
                        "ok": False,
                        "expected": [lo, hi],
                        "actual": have,
                        "reason": "absent or rare in the profile",
                    }
                )
            else:
                thin += 1
            continue
        if not band and want == have == 0:
            continue
        ok = lo <= have <= hi
        rows.append(
            {
                "key": key,
                "ok": ok,
                "expected": [lo, hi],
                "actual": have,
                "reason": "within range" if ok else "outside range",
            }
        )
    rows.sort(key=lambda row: row["ok"])
    return rows, thin, got


def cmd_check(args):
    profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
    draft = Path(args.draft).read_text(encoding="utf-8").strip()
    rows, thin, got = compare(profile, draft, args.min_expected)
    print(f"Draft: {got['meta']['words']} words, {got['meta']['sentences']} sentences")
    for row in rows:
        mark = "ok" if row["ok"] else "!!"
        print(
            f"{mark} {row['key']}: profile {row['expected']}, draft {row['actual']}; {row['reason']}"
        )
    bad = sum(not row["ok"] for row in rows)
    print(f"Outside range: {bad} of {len(rows)}; sparse metrics skipped: {thin}")
    if got["meta"]["words"] < 120:
        print(
            "[!] Short draft: interpret only large differences; this is not a style pass/fail verdict."
        )
    return 1 if args.strict and bad else 0


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    corpus = sub.add_parser("corpus", help="Assemble an author's texts")
    corpus.add_argument("paths", nargs="*")
    corpus.add_argument("--telegram", help="One Telegram Desktop chat export")
    corpus.add_argument("--keep-forwards", action="store_true")
    corpus.add_argument("--min-chars", type=int, default=0)
    corpus.add_argument("-o", "--out", required=True)
    corpus.set_defaults(func=cmd_corpus)
    metrics = sub.add_parser("metrics", help="Measure an English corpus")
    metrics.add_argument("corpus")
    metrics.add_argument("--json", metavar="FILE")
    metrics.add_argument("--ngrams", type=int, default=0)
    metrics.add_argument("--ngram-size", type=int, default=3)
    metrics.add_argument("--openers", type=int, default=0)
    metrics.add_argument("--no-bands", action="store_true")
    metrics.set_defaults(func=cmd_metrics)
    check = sub.add_parser("check", help="Compare a draft with an English profile")
    check.add_argument("profile")
    check.add_argument("draft")
    check.add_argument("--strict", action="store_true", help="Exit 1 for measured deviations")
    check.add_argument("--min-expected", type=float, default=1.5)
    check.set_defaults(func=cmd_check)
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        parser.exit(2, f"error: {error}\n")


if __name__ == "__main__":
    sys.exit(main())
