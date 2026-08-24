// The Pokémon Center on the Northern League forecourt — the last heal before the
// climb. Reuses PokemonCenterScene (nurse, healing machines, storage PC) so it
// behaves like every other Center, and exits back onto the parade ground.
import { PokemonCenterScene } from './interior/PokemonCenterScene';

export class NorthernPCScene extends PokemonCenterScene {
  constructor() {
    super();
    (this as unknown as { sys: { settings: { key: string } } }).sys.settings.key = 'NorthernPCScene';
  }
  protected override exitToWorld() {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('NorthernPlazaScene'));
  }
}
