# Firebase leaderboard setup

The game uses Firebase Anonymous Authentication and Cloud Firestore in project
`pokemonkorea-f01d4`. Firebase Analytics is deliberately not initialized because
the leaderboard does not need behavioral analytics.

## Current project configuration

- **Anonymous Authentication** is enabled. Automatic cleanup is disabled so a
  trainer keeps the same anonymous leaderboard identity.
- The default **Cloud Firestore Standard** database runs in production mode in
  `asia-northeast3` (Seoul).
- `bryancha-ui.github.io`, the Firebase hosting domains, and `localhost` are
  registered as authorized domains.
- The checked-in security rules and the two required compound indexes are
  published to project `pokemonkorea-f01d4`.

## Deploy future security-rule changes

From the repository root:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project pokemonkorea-f01d4
```

The web configuration is public by design. Access control is enforced by
`firestore.rules`, not by hiding the Firebase API key.

Each anonymous Firebase identity owns one aggregate document. Starting a new
game cannot flood the table: faster milestone/league times, the best overall
progress time, and the highest catch totals are retained transactionally.
Pre-leaderboard saves remain visible locally but are not uploaded because their
historic clear times cannot be reconstructed reliably.

## Optional abuse protection

For stronger protection against scripted clients, register the GitHub Pages site
with Firebase App Check and a reCAPTCHA provider. A static client cannot fully
prove that submitted speedrun data was produced by unmodified game code, so
competitive or prize-bearing rankings should eventually use trusted server-side
validation as well.
