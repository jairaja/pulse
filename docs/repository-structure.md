# Suggested GitHub repository structure

- `app/` mobile routes and navigation
- `src/` app source modules
- `supabase/` migrations, seed data, edge functions
- `docs/` runbooks and architecture docs
- `.github/ISSUE_TEMPLATE/` issue templates

## Branch strategy
- `main` protected production branch
- `develop` integration branch
- `feature/*` short-lived feature branches

## CI
- lint + typecheck + test on pull requests
- migration SQL lint
- Expo preview build per PR (optional)
