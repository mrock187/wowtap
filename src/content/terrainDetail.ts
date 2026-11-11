import type { MapLayer } from '../domain/content'
import details from './terrainDetail.json'

export function detailTerrain(layer: MapLayer): MapLayer | undefined {
  const image = details.find(detail => detail.base === layer.assetSha256)
  if (!image) return
  return {
    ...layer,
    image: image.image,
    imageWidth: image.width,
    imageHeight: image.height,
    assetSha256: image.sha256,
  }
}
