# Third-party Pokémon 3D models

The numeric GLBs used for PokeAPI species are vendored from the
[Pokémon 3D API assets repository](https://github.com/Pokemon-3D-api/assets).
They are downloaded during development by `scripts/vendor-pokemon3d-models.mjs`;
the released game makes no runtime request to that service.

The upstream repository states that all Pokémon 3D assets remain the property
of Nintendo, Creatures Inc., and GAME FREAK Inc. They are not presented here as
open-licensed assets. Confirm that the project's distribution has the required
authorization before commercial release. Exact URLs, hashes, byte sizes, and
model extensions are recorded in `pokemon3d-sources.json` whenever the vendor
script runs.
