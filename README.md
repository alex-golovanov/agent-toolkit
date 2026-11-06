# Agent Toolkit

Reusable skills and plugins maintained by Alex Golovanov. The first plugin, **Style Skills —
English**, measures a writing voice and helps draft or revise text against that profile.

| Package                                        | Capabilities                                            | Runtime                             |
| ---------------------------------------------- | ------------------------------------------------------- | ----------------------------------- |
| [Style Skills](plugins/style-skills/README.md) | Profile an English voice; write and check drafts        | Python 3.11+, standard library only |
| [Standalone skills](skills/README.md)          | Location for independent skills as the collection grows | Defined by each skill               |

## Use the plugin

Once this repository is published, Claude Code users can register the marketplace and install the
plugin themselves:

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

Prerequisites: Python 3.11+, Node.js 24+, Bun 1.4.2, and Make. The plugin itself does not require
Node.js, Bun, Make, or any third-party Python package. Confirm `python3 --version` meets the minimum
before creating the environment; substitute your installed Python 3.11+ executable if necessary.
Contributors install development dependencies themselves:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
bun install --frozen-lockfile --ignore-scripts
make check PYTHON=.venv/bin/python
```

No commands in `make check` install software. If development tooling is not yet available,
`make test-stdlib` and `make validate` run the same behavioral tests and repository contracts using
Python alone. They do not replace formatting and linting checks.

| Command            | Purpose                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| `make format`      | Apply Ruff fixes, Python formatting, and Prettier formatting                         |
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
