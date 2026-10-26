(function exposeColorHelpers(root, factory) {
  const helpers = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = helpers;
  }

  root.ColorTools = helpers;
})(typeof globalThis !== "undefined" ? globalThis : this, function createColorHelpers() {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function toHexChannel(value) {
    return Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, "0");
  }

  function hexToRgb(hex) {
    const normalized = String(hex).trim().replace(/^#/, "");

    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return null;
    }

    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);

    if (!rgb) {
      return { h: 0, s: 0, l: 0 };
    }

    const red = rgb.r / 255;
    const green = rgb.g / 255;
    const blue = rgb.b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const lightness = (max + min) / 2;
    let hue = 0;

    if (delta !== 0) {
      if (max === red) {
        hue = ((green - blue) / delta) % 6;
      } else if (max === green) {
        hue = (blue - red) / delta + 2;
      } else {
        hue = (red - green) / delta + 4;
      }
    }

    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

    return {
      h: Math.round(((hue * 60) + 360) % 360),
      s: Math.round(saturation * 100),
      l: Math.round(lightness * 100),
    };
  }

  function hslToHex(hue, saturation, lightness) {
    const h = ((Number(hue) % 360) + 360) % 360;
    const s = clamp(Number(saturation), 0, 100) / 100;
    const l = clamp(Number(lightness), 0, 100) / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const section = h / 60;
    const secondary = chroma * (1 - Math.abs((section % 2) - 1));
    let red = 0;
    let green = 0;
    let blue = 0;

    if (section < 1) {
      red = chroma;
      green = secondary;
    } else if (section < 2) {
      red = secondary;
      green = chroma;
    } else if (section < 3) {
      green = chroma;
      blue = secondary;
    } else if (section < 4) {
      green = secondary;
      blue = chroma;
    } else if (section < 5) {
      red = secondary;
      blue = chroma;
    } else {
      red = chroma;
      blue = secondary;
    }

    const match = l - chroma / 2;

    return `#${toHexChannel((red + match) * 255)}${toHexChannel((green + match) * 255)}${toHexChannel((blue + match) * 255)}`;
  }

  return {
    hexToHsl,
    hexToRgb,
    hslToHex,
  };
});
