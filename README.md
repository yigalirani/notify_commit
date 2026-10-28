# @yigal/notify_commit

CLI tool that sends an email with an HTML report of the latest git commit (metadata + full diff) using the Gmail API with a Google service account.

## Install

```sh
npm install -g @yigal/notify_commit
```

## Setup

1. In Google Cloud Console, create a service account with domain-wide delegation and enable the Gmail API.
2. Download the service account JSON key.
3. Grant the service account delegated access to the sender mailbox with the `https://www.googleapis.com/auth/gmail.send` scope (see [Google's OAuth2 service-account docs](https://developers.google.com/identity/protocols/oauth2/service-account)).

## Usage

Set the required environment variables, then run from inside a git repository:

```sh
export KEYJSON="$(cat service-account-key.json)"   # service-account key as a JSON string
export KEYFROM="yigal@symbolclick.com"             # sender email address
export KEYTO="alice@example.com,bob@example.com"   # comma-separated recipients

notify_commit
```

The tool reads the most recent commit on `HEAD`, builds a self-contained HTML report (commit description, author, files changed, and the diff), and emails it to the recipients.

## Use as a GitHub Action

Add a workflow that runs after each push. Store the service-account JSON, sender, and recipients as repository secrets.

`.github/workflows/notify-commit.yml`:

```yaml
name: notify commit
on:
  push:
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Email commit report
        env:
          KEYJSON: ${{ secrets.GMAIL_SERVICE_ACCOUNT_KEY }}
          KEYFROM: ${{ secrets.GMAIL_FROM }}
          KEYTO: ${{ secrets.GMAIL_TO }}
        run: npx --yes @yigal/notify_commit
```

Notes:

- `fetch-depth: 1` is enough because the tool reads only `HEAD` via `git log -1` and `git show`.
- `GMAIL_SERVICE_ACCOUNT_KEY` must contain the full service-account key as a single JSON string (put it on one line in the secret, or set it with `KEYJSON="$(cat key.json)"` locally first to copy the exact string).
- `GMAIL_TO` accepts one or more comma-separated addresses, e.g. `alice@example.com,bob@example.com`.
- Pin a version for reproducible runs: `npx --yes @yigal/notify_commit@1.0.0`.

## Scope note

The bundled output is for the CLI (`bin` entry `notify_commit`). Programmatic use is possible by importing the package, but the API is not stabilized yet.

## License

ISC
