export function buildSparklinePoints(
  data: number[],
  width = 100,
  height = 40,
  padding = 6,
): string {
  if (data.length === 0) return "";
  if (data.length === 1) {
    const y = height / 2;
    return `0,${y} ${width},${y}`;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const innerHeight = height - padding * 2;

  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padding + innerHeight - ((v - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");
}

export function buildSparklineAreaPoints(
  data: number[],
  width = 100,
  height = 40,
  padding = 6,
): string {
  const line = buildSparklinePoints(data, width, height, padding);
  if (!line) return "";
  return `${line} ${width},${height} 0,${height}`;
}
