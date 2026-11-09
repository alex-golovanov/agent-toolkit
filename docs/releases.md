# Release procedure

A tagged release is a reviewed, tested commit with an explicit plugin version and changelog entry.
Plugin versions are independent: Style Skills is 0.1.0 and BB Auto Compact is 0.3.0 in source.
Publishing commits to `main` makes the explicit branch-tracking BB Git install available; it does
not create a semver tag or GitHub release.

1. Update the affected plugin's manifest version using semantic versioning. Update metrics schema
   versions separately when their meaning changes, and test rejection or migration of incompatible
   profiles.
2. Move relevant changelog entries into a dated release section. Check provenance, license notices,
   installation examples, and any declared compatibility limits.
3. Run `make format`, `make check`, and `git diff --check`. Review the staged diff for private
   corpora, generated profiles, credentials, and accidental local paths.
4. Test the plugin from a relocated temporary copy. If the maintainer has Claude Code, also run
   `claude plugin validate .` and `claude plugin validate plugins/style-skills`. Do not install
   Claude or register the plugin just to run a check.
5. Commit the reviewed change. Push only on the owner's explicit instruction. Wait for the GitHub
   **Quality / quality** and compatibility jobs to pass.
6. On explicit release authorization, tag the reviewed commit as `style-skills-v<version>` and
   publish release notes describing behavior, compatibility, tests, and limitations. No generated
   archives are required.

## Repository protection after publication

After CI has run at least once, configure main-branch protection requiring pull requests and the
quality/compatibility statuses. Enable GitHub private vulnerability reporting. These are separate
repository settings; the presence of workflow and policy files does not mean those settings have
been enabled.

Dependency upgrades require maintainer review. Update exact versions and the Bun lockfile
deliberately, run the full gate, and update pinned GitHub Action commits after checking their
upstream releases. Do not run automated dependency installers or attach installation hooks to Git
operations.

## BB branch-tracking distribution

BB Auto Compact is indexed by `.bb/plugins.json` at `plugins/bb-plugin-auto-compact/`. The
documented installation tracks this repository's `main` branch with the collection selector
`bb-plugin-auto-compact`. A reviewed commit and authorized Git push are sufficient to make that
source available. No npm publication, BB marketplace submission, release tag, or GitHub release is
part of this workflow. Read-only repository visibility checks do not change repository settings.

Before pushing, run the applicable checks, build the plugin with the existing BB toolchain, review
all outgoing commits for private data, and confirm the destination branch. The Quality workflow runs
after pushing; verify its status against the pushed commit. Do not claim a tagged release or
marketplace listing from a Git push alone.
