// The Pokémon Center in the League courtyard — the last heal before the climb.
// Reuses PokemonCenterScene (nurse, healing machines, storage PC) so it behaves
// exactly like every other Center in the region, and exits back to the plaza.
import { PokemonCenterScene } from './interior/PokemonCenterScene';

export class LeaguePCScene extends PokemonCenterScene {
  constructor() {
    super();
    (this as unknown as { sys: { settings: { key: string } } }).sys.settings.key = 'LeaguePCScene';
  }
  protected override exitToWorld() {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('LeaguePlazaScene'));
  }
}
