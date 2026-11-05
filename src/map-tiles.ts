/**
 * Basemap tiles for the map.
 *
 * Policy constraint: `tile.openstreetmap.org` must never be requested
 * directly. Those servers are funded by donations and the OSM Foundation
 * blocks applications that bypass its tile usage policy, so a documentary
 * site has no business depending on them.
 *
 * Provider: the German OSM community's tile server (FOSSGIS e.V.), the
 * keyless, donation-funded CDN listed in the OSM wiki's raster tile provider
 * index for non-commercial, low-traffic use. Its usage policy is linked from
 * that index (`openstreetmap.de/germanstyle`); commercial and high-traffic use
 * is restricted, which does not apply here.
 *
 * Verified limits (checked against the live server):
 * - tiles are served up to zoom 18; zoom 19 and deeper return blank tiles,
 *   which is why `maxZoom` stops at 18;
 * - only 256px tiles are served, so `detectRetina` stays off (enabling it
 *   without an `{r}` placeholder would quadruple requests to a
 *   donation-funded server for no visible gain);
 * - no subdomain placeholder, so no `{s}` and no `subdomains`.
 *
 * The URL lives in one constant on purpose: the OSM tile policy itself
 * recommends keeping the tile source swappable without a code rewrite.
 */

export interface TileConfig {
  /** URL template with Leaflet placeholders. */
  url: string;
  /** Attribution HTML, rendered by Leaflet's attribution control. */
  attribution: string;
  /** Tile subdomains, only meaningful when the URL contains `{s}`. */
  subdomains?: string;
  /** Zoom levels supported by the provider and meaningful for the city. */
  minZoom: number;
  maxZoom: number;
  /** Serve `@2x` tiles on retina screens; requires `{r}` in the URL. */
  detectRetina: boolean;
}

export const MAP_TILES: TileConfig = {
  url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  minZoom: 10,
  maxZoom: 18,
  detectRetina: false,
};
