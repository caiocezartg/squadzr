/** IGDB serves every image in named sizes; the hero draws covers at the board's size. */
const IGDB_IMAGES = 'https://images.igdb.com/igdb/image/upload'

/** A game's IGDB cover at the size the board's squad card takes. */
export function coverUrl(imageId: string): string {
  return `${IGDB_IMAGES}/t_cover_big/${imageId}.jpg`
}

/**
 * The covers the hero's backdrop drifts through, all from the catalog. The wall reads them in columns, so
 * neighbours in this list end up far apart on screen.
 */
export const WALL_COVER_IDS: readonly string[] = [
  'cocqbp',
  'coc99o',
  'coaczd',
  'cobfk4',
  'cocqh2',
  'cocxbi',
  'cod2we',
  'cocyri',
  'co5ive',
  'co9rk1',
  'cocsnm',
  'co6kqt',
  'coaam4',
  'co5zky',
  'coc89g',
  'coabbf',
  'cocsmb',
  'cod6ev',
  'co7n02',
  'co8fu7',
  'coco22',
  'co2558',
  'coamcz',
  'co1y2f',
  'cocygu',
  'co9wxo',
  'coa7cs',
  'coajjj',
  'co2dto',
  'cob22v',
  'co4jni',
  'co904o',
  'coctqy',
  'co6i3u',
  'co1sh2',
  'co2lbd',
]
