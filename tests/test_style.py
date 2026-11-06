"""Behavioral regression tests with synthetic, public English inputs."""

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "plugins/style-skills/skills/style-portrait/style.py"
SPEC = importlib.util.spec_from_file_location("style", SCRIPT)
style = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(style)


def post(count=12):
    return " ".join(["We test a small idea before we build the whole thing."] * count)


class EnglishMetricsTests(unittest.TestCase):
    def test_contractions_and_possessives_are_single_tokens(self):
        self.assertEqual(
            style.words("I'm sure we’re ready for Alex's well-made café."),
            ["I'm", "sure", "we're", "ready", "for", "Alex's", "well-made", "café"],
        )

    def test_apostrophe_variants_have_identical_metrics(self):
        straight = style.analyze(["I'm sure you're ready. We don't need more."])
        curly = style.analyze(["I’m sure you’re ready. We don’t need more."])
        for section in ("geometry", "lexicon", "markers_per_1000"):
            self.assertEqual(straight[section], curly[section])

    def test_marker_boundaries_do_not_match_substrings_or_hyphens(self):
        pattern = style.GROUP_PATTERNS["pronouns_1sg"]
        self.assertEqual(
            pattern.findall("minefield timely my I myself me-me"), ["my", "I", "myself"]
        )

    def test_contracted_pronouns_count_once(self):
        pattern = style.GROUP_PATTERNS["pronouns_1sg"]
        self.assertEqual(len(pattern.findall("I'm here; I've tried; I'll go; I'd wait.")), 4)

    def test_multiword_markers_count_as_one_occurrence(self):
        result = style.analyze(["For example, perhaps we should wait."])
        self.assertAlmostEqual(result["markers_per_1000"]["discourse_markers"], 1000 / 6, places=2)
        self.assertAlmostEqual(result["markers_per_1000"]["hedges"], 1000 / 6, places=2)
        self.assertAlmostEqual(result["markers_per_1000"]["obligation"], 1000 / 6, places=2)

    def test_possessive_s_is_not_guessed_as_a_contraction(self):
        result = style.analyze(["Alex's cat isn't here. It's outside; we're waiting."])
        self.assertEqual(result["lexicon"]["contractions_per_1000"], round(2000 / 8, 2))

    def test_titles_initials_decimals_and_quotes(self):
        text = 'Dr. J. Smith paid 3.5 dollars. "Done!" We left.'
        self.assertEqual(len(style.sentences(text)), 3)

    def test_newlines_delimit_unpunctuated_lists(self):
        self.assertEqual(
            style.sentences("One item\nAnother item\n\nLast item"),
            ["One item", "Another item", "Last item"],
        )

    def test_sentence_geometry_matches_hand_count(self):
        result = style.analyze(["We go. Then we go home."])
        self.assertEqual(result["meta"]["words"], 6)
        self.assertEqual(result["meta"]["sentences"], 2)
        self.assertEqual(result["geometry"]["sentence_words_mean"], 3)
        self.assertEqual(result["geometry"]["sentence_words_sd"], 1)

    def test_urls_do_not_change_lexicon_or_sentence_geometry(self):
        original = style.analyze(["We make useful things."])
        linked = style.analyze(["We make useful things. https://example.com/some-path?q=yes"])
        self.assertEqual(original["lexicon"], linked["lexicon"])
        self.assertEqual(original["meta"]["words"], linked["meta"]["words"])
        self.assertEqual(
            original["geometry"]["sentence_words_mean"], linked["geometry"]["sentence_words_mean"]
        )

    def test_mattr_distinguishes_local_diversity_from_whole_corpus_ttr(self):
        tokens = list("abcdefghij") * 5
        self.assertEqual(style.mattr(tokens, 10), 1)
        self.assertLess(len(set(tokens)) / len(tokens), style.mattr(tokens, 10))

    def test_short_mattr_is_explicit_raw_ttr_fallback(self):
        self.assertEqual(style.mattr(["a", "b", "a"], 500), round(2 / 3, 3))
        self.assertEqual(style.mattr([], 500), 0)
        with self.assertRaises(ValueError):
            style.mattr(["a"], 0)

    def test_hapax_uses_unique_word_denominator(self):
        self.assertEqual(
            style.analyze(["red red blue green"])["lexicon"]["hapax_share"], round(2 / 3, 3)
        )

    def test_empty_inputs_raise_useful_errors(self):
        for texts in ([], [""], ["..."], ["https://example.com"]):
            with self.subTest(texts=texts), self.assertRaises(ValueError):
                style.analyze(texts)

    def test_first_line_formatting_is_counted(self):
        for text, key in (
            ("- first\n- second", "bullet_items"),
            ("1. first\n2. second", "numbered_items"),
            ("# first\n## second", "markdown_headings"),
        ):
            with self.subTest(key=key):
                self.assertEqual(style.analyze([text])["formatting_per_text"][key], 2)

    def test_dashes_keep_ranges_separate(self):
        result = style.analyze(["We wait — then go – and stop - at 20–42."])["punctuation_per_1000"]
        self.assertEqual(result["em_dash"], result["en_dash"])
        self.assertEqual(result["en_dash"], result["hyphen_as_dash"])

    def test_ngram_counts_do_not_cross_posts(self):
        self.assertEqual(
            style.top_ngrams(["alpha beta", "gamma delta"] * 2, 2, 10),
            [{"phrase": "alpha beta", "count": 2}, {"phrase": "gamma delta", "count": 2}],
        )

    def test_ngram_apostrophes_match_tokenizer(self):
        self.assertEqual(
            style.top_ngrams(["we’re ready", "we're ready"], 2, 10),
            [{"phrase": "we're ready", "count": 2}],
        )

    def test_metadata_discloses_language_schema_and_morphology(self):
        result = style.analyze([post()])
        self.assertEqual(result["meta"]["language"], "en")
        self.assertEqual(result["meta"]["schema_version"], 2)
        self.assertFalse(result["meta"]["morphology"])
        self.assertFalse(result["morphology"]["computed"])
        self.assertNotIn("latin_per_1000", result["lexicon"])


class ComparisonTests(unittest.TestCase):
    def test_bands_require_both_count_and_length(self):
        for texts, used in (([post()] * 7, 7), (["Short."] * 20, 0)):
            result, diagnostic = style.bands(texts)
            self.assertEqual(result, {})
            self.assertEqual(diagnostic["used"], used)
        result, _ = style.bands([post()] * 8 + ["Short."])
        self.assertEqual(result["_texts_used"], 8)

    def test_bands_follow_sorted_sample_order_statistics(self):
        texts = [" ".join(["word"] * count) + "." for count in range(80, 90)]
        result, _ = style.bands(texts)
        band = result["geometry"]["sentence_words_mean"]
        self.assertEqual(band, {"p10": 80, "median": 84, "p90": 88})

    def test_identical_text_has_no_deviations(self):
        profile = style.analyze([post()])
        rows, _, _ = style.compare(profile, post())
        self.assertTrue(rows)
        self.assertTrue(all(row["ok"] for row in rows))

    def test_new_officialese_is_flagged(self):
        profile = style.analyze([post()])
        rows, _, _ = style.compare(profile, "Pursuant to the aforementioned rule, we shall wait.")
        marker = next(row for row in rows if row["key"] == "officialese")
        self.assertFalse(marker["ok"])
        self.assertEqual(marker["reason"], "absent or rare in the profile")

    def test_bands_override_corpus_mean_tolerance(self):
        profile = style.analyze([post()])
        profile["bands"] = {"geometry": {"sentence_words_mean": {"p10": 1, "median": 2, "p90": 4}}}
        rows, _, _ = style.compare(profile, "We go.")
        row = next(row for row in rows if row["key"] == "sentence_words_mean")
        self.assertTrue(row["ok"])
        self.assertGreater(profile["geometry"]["sentence_words_mean"], 4)

    def test_wrong_language_and_old_schema_are_rejected(self):
        for key, value in (("language", "ru"), ("schema_version", 1)):
            profile = style.analyze([post()])
            profile["meta"][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "Incompatible"):
                style.compare(profile, post())

    def test_missing_metrics_cannot_produce_a_false_pass(self):
        profile = style.analyze([post()])
        del profile["geometry"]["burstiness"]
        with self.assertRaises(ValueError):
            style.compare(profile, post())

    def test_invalid_numeric_profile_values_are_rejected(self):
        for value in (True, float("nan"), float("inf"), -1, "3"):
            profile = style.analyze([post()])
            profile["geometry"]["burstiness"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                style.compare(profile, post())

    def test_invalid_bands_are_rejected(self):
        profile = style.analyze([post()])
        for band in ({"p10": 3, "median": 2, "p90": 1}, {"p10": 1}, []):
            invalid = copy.deepcopy(profile)
            invalid["bands"] = {"geometry": {"burstiness": band}}
            with self.subTest(band=band), self.assertRaises(ValueError):
                style.compare(invalid, post())

    def test_invalid_sparse_threshold_is_rejected(self):
        for threshold in (-1, float("inf"), float("nan")):
            with self.subTest(threshold=threshold), self.assertRaises(ValueError):
                style.compare(style.analyze([post()]), post(), threshold)


class CorpusAndCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPT), *map(str, args)],
            cwd=self.root,
            capture_output=True,
            text=True,
            check=False,
        )

    def write(self, name, content):
        path = self.root / name
        path.write_text(content, encoding="utf-8")
        return path

    def test_frontmatter_and_flat_boundaries(self):
        text = "---\ntitle: Private title\n---\nFirst post.\n---\nSecond post."
        self.assertEqual(style.split_flat(text), ["First post.", "Second post."])
        self.assertEqual(
            style.split_flat("First.\n\nParagraph.\n\n\nSecond."),
            ["First.\n\nParagraph.", "Second."],
        )

    def test_single_file_directory_does_not_split_posts(self):
        self.write("one.md", "First paragraph.\n---\nSecond paragraph.")
        self.assertEqual(len(style.from_files([self.root])), 1)

    def test_telegram_filters_forwards_and_service_messages(self):
        export = {
            "messages": [
                {"type": "message", "id": 1, "text": ["Our ", {"text": "words"}]},
                {"type": "message", "id": 2, "text": "Other voice", "forwarded_from": "Someone"},
                {"type": "message", "id": 3, "text": ""},
                {"type": "service", "text": "A service message"},
            ]
        }
        path = self.write("telegram.json", json.dumps(export))
        self.assertEqual([item[2] for item in style.from_telegram(path)], ["Our words"])
        self.assertEqual(len(style.from_telegram(path, keep_forwards=True)), 2)

    def test_multi_chat_export_is_not_silently_truncated(self):
        path = self.write("telegram.json", json.dumps({"chats": {"list": [{}, {}]}}))
        result = self.run_cli("corpus", "--telegram", path, "-o", "corpus.md")
        self.assertEqual(result.returncode, 2)
        self.assertIn("exactly one", result.stderr)

    def test_end_to_end_corpus_metrics_check(self):
        source = self.root / "articles"
        source.mkdir()
        for index in range(8):
            (source / f"{index}.md").write_text(post(), encoding="utf-8")
        corpus = self.root / "corpus.md"
        profile = self.root / "profile.json"
        draft = self.write("draft.md", post())
        self.assertEqual(self.run_cli("corpus", source, "-o", corpus).returncode, 0)
        measured = self.run_cli("metrics", corpus, "--json", profile, "--ngrams", 5, "--openers", 3)
        self.assertEqual(measured.returncode, 0, measured.stderr)
        data = json.loads(profile.read_text())
        self.assertEqual(data["meta"]["texts"], 8)
        self.assertEqual(data["bands"]["_texts_used"], 8)
        self.assertEqual(self.run_cli("check", profile, draft, "--strict").returncode, 0)

    def test_strict_failure_and_advisory_success(self):
        profile = self.write("profile.json", json.dumps(style.analyze([post()])))
        draft = self.write("draft.md", "Pursuant to the aforementioned rule, we shall wait!")
        self.assertEqual(self.run_cli("check", profile, draft).returncode, 0)
        strict = self.run_cli("check", profile, draft, "--strict")
        self.assertEqual(strict.returncode, 1)
        self.assertIn("Short draft", strict.stdout)

    def test_invalid_cli_inputs_return_error_without_traceback(self):
        malformed = self.write("invalid.json", "{broken")
        empty = self.write("empty.md", "")
        for args in (
            ("metrics", "missing.md"),
            ("metrics", empty),
            ("corpus", "-o", "corpus.md"),
            ("corpus", empty, "--min-chars", -1, "-o", "corpus.md"),
            ("check", malformed, empty),
        ):
            result = self.run_cli(*args)
            self.assertEqual(result.returncode, 2, result)
            self.assertNotIn("Traceback", result.stderr)

    def test_small_corpus_warning_is_independent_of_bands(self):
        source = self.write("source.md", "\n---\n".join([post()] * 8))
        corpus = self.root / "corpus.md"
        collected = self.run_cli("corpus", source, "-o", corpus)
        self.assertIn("20,000", collected.stderr)
        measured = self.run_cli("metrics", corpus)
        self.assertEqual(measured.returncode, 0)
        self.assertNotIn("No bands", measured.stderr)


if __name__ == "__main__":
    unittest.main()
