import type { ReactNode } from 'react'

import { isLayerActive, type LayerId } from '../utils/layers'

export function LayerGate({
  activeLayers,
  layer,
  children,
  fallback,
}: {
  activeLayers: unknown
  layer: LayerId
  children: ReactNode
  fallback?: ReactNode
}) {
  return isLayerActive(activeLayers, layer) ? children : (fallback ?? null)
}

