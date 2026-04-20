/** CSS value for one cell edge (left / bottom) from settings. */
export function cssCellEdgeBorder(
  show: boolean,
  widthPx: number,
  color: string,
  style: 'solid' | 'double',
): string {
  if (!show) return 'none';
  const w = Math.max(1, widthPx);
  if (style === 'double') return `${Math.max(3, w)}px double ${color}`;
  return `${w}px solid ${color}`;
}
