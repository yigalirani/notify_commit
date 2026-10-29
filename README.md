# @yigal/notify_commit

Easily configure github to send an email on every new commit. The email contains an html report with an embedded diff and metadata and is sent using your Gmail account

## Prerequisites
1. Git project that is stored on github
1. Gmail service account with permission to send emails from an authorized email address

## Setup
1. In Google Cloud Console, Follow the instructions in https://developers.google.com/identity/protocols/oauth2/service-account to obtain 'public/private key pair'
1. Copy the resulting key to your clipboard
1. In your github page for your repo, create a new secret named `KEYJSON` and paste the key there. https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
1. Add a workflow by adding this file to your project. Push and commit your changes.

`.github/workflows/notify-commit.yml`:

```yaml
name: Notify commit
on:
  push:
    branches: ["**"]
permissions:
  contents: read
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npx --yes @yigal/notify_commit
        env:
          KEYJSON: ${{ secrets.KEYJSON }}
          KEYFROM: <authorized email address>
          KEYTO: <comma-seprated recipient list>
```

That's it! After committing the change, you will start getting emails with a nice HTML report after every commit.


## License

ISC
