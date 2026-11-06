PYTHON ?= python3

.PHONY: check format lint test test-stdlib validate

check:
	$(PYTHON) -m ruff format --check .
	$(PYTHON) -m ruff check .
	bun run format:check
	bun run lint:markdown
	$(PYTHON) scripts/validate_repository.py
	$(PYTHON) -m pytest

format:
	$(PYTHON) -m ruff check --fix .
	$(PYTHON) -m ruff format .
	bun run format

lint:
	$(PYTHON) -m ruff check .
	bun run lint:markdown

test:
	$(PYTHON) -m pytest

test-stdlib:
	$(PYTHON) -m unittest discover -s tests -v

validate:
	$(PYTHON) scripts/validate_repository.py
