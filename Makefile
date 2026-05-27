.PHONY: format format-backend format-frontend lint lint-backend lint-frontend check check-format typecheck

format: format-backend format-frontend

format-backend:
	cd backend && uv run --no-sync ruff format .

format-frontend:
	cd frontend && yarn run format

lint: lint-backend lint-frontend

lint-backend:
	cd backend && uv run --no-sync ruff check .

lint-frontend:
	cd frontend && yarn run lint

check: check-format lint typecheck

check-format:
	cd backend && uv run --no-sync ruff format --check .
	cd frontend && yarn run check-format

typecheck:
	cd frontend && yarn exec tsc --noEmit
