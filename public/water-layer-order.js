// Raster context stays beneath water vectors and selected reference markers,
// regardless of which independent request finishes first.
const foreground=new Set(['network-water-fill','network-water-lines','network-water-labels','official-drain-lines','official-polder-fill','official-polder-lines','network-gauges','polder-budget-fill','polder-budget-line','polder-budget-point','polder-preparedness-points']);
export function waterOverlayAnchor(map){
 return map.getStyle?.().layers?.find(layer=>foreground.has(layer.id))?.id||[...foreground].find(id=>map.getLayer(id));
}
