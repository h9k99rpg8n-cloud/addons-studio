# Contributing to Addons Studio

Thank you for helping build a free, mobile-first Bedrock creation environment.

## Before starting

1. Check that the change belongs in the current release scope.
2. Preserve local-project compatibility and existing repository history.
3. Confirm that every new dependency has a compatible license and a clear purpose.
4. Update `THIRD_PARTY_NOTICES.md` when an important dependency changes.

Addons Studio is MIT-licensed. Do not copy GPL source code from Blockbench, bridge., or other GPL applications. UX patterns, high-level workflows, and concepts may be studied, but the implementation here must be original unless a dependency is explicitly license-compatible.

## Local setup

```bash
npm ci
npm run dev
```

Use Node.js 24 when possible. The package requires Node 22.12 or newer.

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Engineering expectations

- Use strict TypeScript and small, explicit domain contracts.
- Put domain behavior under `src/core`, not inside presentation components.
- Keep route-level features lazy-loaded.
- Use Lucide only for generic actions; product-specific concepts belong in the typed `StudioIcon` family.
- Preserve the Creative Core Cube proportions and documented brand palette when changing brand assets.
- Add tests for project-schema, persistence, or registry changes.
- Use semantic HTML and visible focus states.
- Keep every essential action usable by touch with no hover dependency.
- Preserve 44 × 44 CSS-pixel minimum interactive targets.
- Verify portrait and landscape layouts and all iPhone safe areas.
- Label unavailable features “Coming soon”; never simulate success.
- Do not add a large framework or editor engine without an architectural proposal.

## Commits and pull requests

Use focused commits with imperative messages. Describe data migrations, mobile behavior, licensing impact, and test coverage in the pull request. Include screenshots for visible UI changes when practical.

By contributing, you agree that your contribution is licensed under the repository’s MIT License.
