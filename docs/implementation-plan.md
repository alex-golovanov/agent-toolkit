# Agent Toolkit implementation plan

Workspace: repository root. Design: [approved scope](design.md).

1. Establish the collection layout, marketplace, provenance, and quality commands. Verify metadata
   and local links with the repository validator.
2. Port the analyzer and both skill instructions. Add English behavioral tests before running the
   implementation. Test contractions, markers, sentence boundaries, corpus isolation, comparison
   bands, schema mismatch, and CLI exits.
3. Add contributor documentation, release procedures, and CI. Run the full standard-library suite
   and every available formatting and linting check. Report unavailable tools explicitly; do not
   install them.
4. Commit logical steps, create the public GitHub repository without pushing, and report local
   commit and validation status.

External input: Vyacheslav Startsev's MIT-licensed `claude-plugins` repository, commit
`5de61ae6109a1fdaa4e412364984b6525e0bd8a7`. The port includes the adapted analyzer and preserved
license; provenance records the exact upstream paths.

No UI or motion changes. No paid model calls or private corpus inputs are needed.
