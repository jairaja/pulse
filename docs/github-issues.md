# PULSE GitHub delivery backlog

The issue catalog is stored in [`github-issues.json`](./github-issues.json). It separates technical
enablers from functional product decisions so an infrastructure task cannot quietly decide user
behavior, and a UX issue cannot bypass security prerequisites.

## Create the issues

Prerequisites:

1. Install GitHub CLI (`gh`).
2. Authenticate with `gh auth login` using an account that can create issues.
3. Ensure the repository has a GitHub remote, or pass `--repo OWNER/REPO`.

Preview without writing:

```bash
npm run issues:preview -- --repo jairaja/pulse
```

Create missing issues:

```bash
npm run issues:create -- --repo jairaja/pulse --apply
```

The importer is idempotent. Every issue body contains a stable `pulse-issue-id` marker; an issue is
skipped when that marker already exists in an open or closed issue.

## Delivery rule

Technical issues `T01` through `T17` are ordered by dependency rather than by ID alone. No dependent
step proceeds until its prerequisite has acceptance evidence. Functional and research issues may be
refined in parallel, but implementation must respect their `Depends on` sections and explicit
out-of-scope boundaries.
