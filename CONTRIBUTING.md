# Contributing

Thanks for considering a contribution to ChatbotX's mobile app.

## Getting set up

```bash
pnpm install
cp .env.example .env
pnpm start
```

See the [README](README.md) for the full quick start and available scripts.

## Before opening a PR

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
npx expo-doctor
```

CI runs all of these on every push/PR — please run them locally first so review cycles aren't
spent on failures these would have caught.

## Code style

- TypeScript, strict mode. Avoid `any`; narrow `unknown` instead.
- Match existing patterns in the file/feature you're touching before introducing a new one.
- Keep PRs focused — unrelated refactors make review harder and should be a separate PR.

## Commit messages

Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`.

## Reporting bugs / requesting features

Open a GitHub issue with:

- What you expected vs. what happened
- Steps to reproduce (for bugs)
- Your environment (OS, Expo Go vs. dev build, physical device vs. simulator)

## Security issues

Please do not open a public issue for a security vulnerability. See the repository's security
policy (or contact the maintainers directly) instead.

## Scope note

Contributions to the core app (chat, contacts, auth, etc.) are welcome. White-label/brand-specific
work (see [docs/white-label.md](docs/white-label.md)) is maintained by the ChatbotX team for
customer builds and isn't something this repo's contribution flow covers.
