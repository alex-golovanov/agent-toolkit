# Release procedure

A release is a reviewed, tested commit with an explicit plugin version and changelog entry. Version
0.1.0 is prepared in source; it is not a published release until a maintainer creates the tag and
GitHub release.

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

After CI has run at least once, configure a main-branch ruleset requiring pull requests and the
quality/compatibility statuses. Enable GitHub private vulnerability reporting. These are separate
repository settings; the presence of workflow and policy files does not mean those settings have
been enabled.

Dependency upgrades require maintainer review. Update exact versions and the Bun lockfile
deliberately, run the full gate, and update pinned GitHub Action commits after checking their
upstream releases. Do not run automated dependency installers or attach installation hooks to Git
operations.
