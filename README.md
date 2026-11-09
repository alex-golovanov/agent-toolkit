# Agent Toolkit

Reusable skills and plugins maintained by Alex Golovanov. **Style Skills — English** measures a
writing voice and helps draft or revise text against that profile. **BB Auto Compact** schedules
native Codex compaction across eligible BB conversations.

| Package                                                     | Capabilities                                            | Runtime                                           |
| ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| [Style Skills](plugins/style-skills/README.md)              | Profile an English voice; write and check drafts        | Python 3.11+, standard library only               |
| [BB Auto Compact](plugins/bb-plugin-auto-compact/README.md) | Global or selected idle compaction for Codex threads    | BB, existing Codex setup; no package dependencies |
| [Standalone skills](skills/README.md)                       | Location for independent skills as the collection grows | Defined by each skill                             |

## BB Auto Compact · start here

**Global Codex compaction after context exceeds 70% and the conversation is idle for 15 minutes.**
Sol, Astra, and other configured Codex models keep their existing speed and reasoning setting.

```sh
bb plugin install git:https://github.com/alex-golovanov/agent-toolkit.git@main --plugin bb-plugin-auto-compact
bb plugin config auto-compact set scope all
bb plugin config auto-compact set model all
bb plugin config auto-compact set maxAttempts 0
bb plugin config auto-compact set mode compact
bb auto-compact status --json
```

Fresh installs start **off**, with selected scope and one attempt. The commands above enable
**global, ongoing paid operation**; `maxAttempts=0` removes the submission-count limit. The
threshold and idle defaults are already 70% and 15 minutes. Each chat needs fresh model activity
after activation; the plugin does not catch up old idle sessions.

| Before you start | What to know                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Runtime          | BB and an existing Codex setup; tested against BB 0.49.0 / SDK 0.6.132                                             |
| Models           | All configured Codex models; live Sol observations and simulated Astra/multi-speed tests are documented separately |
| Cost             | Native Codex usage applies; the timer estimates an early opportunity and does not detect exact cache expiry        |
| Installation     | The repository's `.bb/plugins.json` selects this BB plugin; the Claude marketplace is separate                     |

**[Read the complete setup, model evidence, settings, and troubleshooting guide →](plugins/bb-plugin-auto-compact/README.md)**

No npm publication or marketplace step is needed for this branch-tracking Git installation.

---

## Style Skills · turn rough ideas into readable prose

A braindump usually has the material you need: the observation, the failed attempt, the useful
change, and the reason it matters. An agent can organize that material into prose. Style Skills adds
an optional way to make the prose resemble your established writing.

The two inputs have different jobs:

| Input                        | What it supplies             | Example                                      |
| ---------------------------- | ---------------------------- | -------------------------------------------- |
| Rough notes or dictation     | What this piece needs to say | An experiment, its result, and your reaction |
| Finished writing you approve | How you want it to read      | Several articles in the same genre           |

Use finished writing to build the portrait. Using raw dictation would also teach it your restarts,
repetition, and unfinished sentences.

### The workflow

1. **Organize the ideas.** Ask the agent to identify the main point, preserve the facts, and flag
   unclear names or missing information.
2. **Draft the piece.** Turn that outline into connected prose for the intended reader.
3. **Apply your voice, if you have a profile.** `writing-in-style` uses the profile's concrete
   instructions while preserving the supplied facts.
4. **Review the result.** The local checker measures differences. You and the agent still review
   meaning, readability, and whether the piece sounds right.

Steps 1 and 2 use the agent's ordinary writing ability. This repository includes a
[reusable drafting request](docs/prompts/braindump-to-prose.md); a dedicated braindump skill is not
implemented. You can start with that request without making a portrait or installing another plugin.

### Build a portrait once, reuse it

`style-portrait` reads a selection of finished English texts and creates two companion files:

| File                  | Contents                                                             | Produced by                    |
| --------------------- | -------------------------------------------------------------------- | ------------------------------ |
| `author-metrics.json` | Sentence lengths, paragraph lengths, word patterns, and other counts | Local Python analyzer          |
| `author-style.md`     | Evidence-backed observations and practical writing instructions      | Agent reading the actual texts |

This is a reusable reference supplied to the agent. It does not train or fine-tune a model. Build it
from the genre you want to write, and revisit it as your preferences or source collection change.

Start with the [profile-building request](docs/prompts/build-voice-profile.md), then use the
[voice-application request](docs/prompts/apply-voice-profile.md). Keep your source writing,
portrait, and drafts in your own project or an ignored local directory. They do not belong in this
public collection.

### What the check can tell you

It can spot a draft with much longer sentences or different surface patterns than your samples. It
cannot establish whether a claim is true, an argument makes sense, or the writing captures your
voice. A clean check is not a quality certificate; a flagged difference may be appropriate.

Small collections produce provisional portraits. Fewer than eight texts of at least 80 words means
there are no per-text comparison bands. Below 20,000 characters, the analyzer separately warns about
corpus size. See the [plugin guide](plugins/style-skills/README.md) for the full limits and
commands.

For the illustrated explanation and a prepared notes-to-draft example, read the
[HTML walkthrough](docs/style-workflow.html) using the
[local viewing instructions](docs/serving.md). The example is synthetic and interactive controls
show prepared text; they do not run a model.

## Install Style Skills

Claude Code users can register this public marketplace and install the plugin themselves:

```text
/plugin marketplace add alex-golovanov/agent-toolkit
/plugin install style-skills@agent-toolkit
```

From a local checkout, an existing Claude Code installation can load the plugin for a session with
`claude --plugin-dir ./plugins/style-skills`. These are manual user actions; repository checks never
install or register plugins.

For another compatible agent, copy both skill folders under `plugins/style-skills/skills/` into its
configured skill directory, keeping them as siblings. Each skill resolves resources from its own
location; only Claude's plugin mode uses `CLAUDE_PLUGIN_ROOT`. See the
[plugin guide](plugins/style-skills/README.md). Structural checks and relocated CLI tests do not
prove runtime compatibility with every agent; no live agent installation is part of the test suite.

## Develop

Prerequisites: Python 3.11+, Node.js 24+, Bun 1.4.2, and Make. Style Skills itself does not require
Node.js, Bun, Make, or any third-party Python package. BB Auto Compact runs inside BB and uses
Node.js for its fake-SDK tests. Confirm `python3 --version` meets the minimum before creating the
environment; substitute your installed Python 3.11+ executable if necessary. Contributors install
development dependencies themselves:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
bun install --frozen-lockfile --ignore-scripts
make check PYTHON=.venv/bin/python
```

No commands in `make check` install software. If development tooling is not yet available,
`make test-stdlib` and `make validate` run behavioral tests and repository contracts without
third-party Python packages. The relocated BB plugin test also requires the installed Node.js
runtime. They do not replace formatting and linting checks.

| Command            | Purpose                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| `make format`      | Apply Ruff fixes, Python formatting, and Oxfmt formatting                            |
| `make check`       | Check formatting, lint Python and Markdown, validate repository metadata, run pytest |
| `make test`        | Run tests with pytest                                                                |
| `make test-stdlib` | Run tests with Python's built-in unittest runner                                     |
| `make validate`    | Check manifests, skill metadata, portable paths, and local file links                |

Set `PYTHON=.venv/bin/python` for Make commands when using the virtual environment. CI uses the same
quality gate and tests Python 3.11–3.14. Remote CI status is available only after the commits are
pushed and the workflow actually runs.

## Contribute and release

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the
[release procedure](docs/releases.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md). The
repository is MIT-licensed; the adapted plugin preserves its upstream author's notice. See
[THIRD_PARTY.md](THIRD_PARTY.md).

Keep private source texts, generated profiles, and credentials outside version control. The included
examples and tests are synthetic; they are not evidence that the analyzer has been calibrated on
real English authors.
