/** El nombre acompaña siempre al color; el texto usa el contraste mayor. */
export function labelInk(color: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const linear = rgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}
