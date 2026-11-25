# Token Radar
Browse a dated protocol snapshot and compare valuation scenarios for projects on the watchlist. The offline dashboard shows which comparable projects were used, where data is missing, and which assumptions drive each estimate.

Node.js 22.18+ or 24; no packages, API keys or wallet are required.
~~~sh
node --test test/model.test.ts
node preview.ts --output /tmp/token-radar-preview
~~~
Use an empty output directory, then open its dashboard/index.html. The included 758-record/40-watchlist snapshot was captured on 14 November 2026. It is a dated reference input, not current market data.

The valuation model is conditional circulating-cap research, not FDV, a trading signal, an airdrop probability or a promise of income. Imported names are rendered as text, not HTML.

main.ts can assemble a dossier after you supply exactly three genuine application screenshots in screenshots/. It refuses partially occupied output directories and does not fabricate screenshot evidence.

MIT licensed; the supplied makefun-board helper retains its upstream notice in THIRD_PARTY_NOTICES.md and THIRD_PARTY_LICENSE.txt. No competition entry or accepted result is claimed. Original dashboard/model developed with AI assistance.

## Continuous integration
A reference GitHub Actions workflow is included at ci/github-actions.yml. To activate it in your own repository, place it under .github/workflows/. Its presence as a reference does not mean hosted CI is enabled or has passed.
