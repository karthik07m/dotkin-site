# Dotkin site

The marketing page and download hub for Dotkin, served by GitHub Pages at
https://karthik07m.github.io/dotkin-site/. Installers are published as releases on
this repo; the page's download buttons read the latest one.

`character.js` and `character.css` are copies of the app's DOT renderer.

## Download counts

`.github/workflows/downloads.yml` runs once a day and appends every release
asset's download count to `downloads.csv` on the `stats` branch, one row per
asset: `date,release,asset,downloads`. The counts are GitHub's running totals,
so a day's downloads are the difference between two rows, and an asset that is
replaced on a release starts again from zero. To read it:

    git fetch origin stats && git show origin/stats:downloads.csv
