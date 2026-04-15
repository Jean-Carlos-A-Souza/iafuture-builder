function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.slice(1).split('').map((char) => char + char).join('')}`.toLowerCase();
  }

  return '#c8a64f';
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn: h = 60 * (((gn - bn) / delta) % 6); break;
      case gn: h = 60 * (((bn - rn) / delta) + 2); break;
      default: h = 60 * (((rn - gn) / delta) + 4); break;
    }
  }

  return {
    h: (h + 360) % 360,
    s: s * 100,
    l: l * 100,
  };
}

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  );
}

export function deriveTheme(input) {
  const primary = normalizeHexColor(input);
  const hsl = hexToHsl(primary);

  return {
    primary,
    light: hslToHex(hsl.h, clamp(hsl.s, 52, 88), clamp(hsl.l + 16, 44, 76)),
    dark: hslToHex(hsl.h, clamp(hsl.s, 44, 86), clamp(hsl.l - 22, 18, 48)),
    soft: `hsla(${hsl.h}, ${Math.round(clamp(hsl.s, 44, 88))}%, ${Math.round(clamp(hsl.l, 34, 62))}%, 0.16)`,
    border: `hsla(${hsl.h}, ${Math.round(clamp(hsl.s, 44, 88))}%, ${Math.round(clamp(hsl.l + 4, 38, 68))}%, 0.32)`,
  };
}

export function applyTheme(color) {
  const theme = deriveTheme(color);
  const root = document.documentElement;
  root.style.setProperty('--primary-color', theme.primary);
  root.style.setProperty('--primary-light', theme.light);
  root.style.setProperty('--primary-dark', theme.dark);
  root.style.setProperty('--accent-color', theme.soft);
  root.style.setProperty('--accent-border', theme.border);
}
