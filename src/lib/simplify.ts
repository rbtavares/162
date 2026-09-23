/**
 * Merges perceptually close colors in an image so it is easier to paint.
 *
 * Colors are compared in CIE Lab space. Colors are visited from most to least
 * frequent; each one either joins the closest existing group whose seed is
 * within a ΔE threshold or starts a new group. Each group is then rendered as
 * its pixel-weighted average color. The threshold is found by binary search,
 * then the closest remaining groups are merged until exactly the requested
 * number of colors is left.
 */

type Lab = [number, number, number];

/** Fewest colors simplification will reduce a painting to. */
export const MIN_COLORS = 12;

function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  // D65 reference white
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a: Lab, b: Lab) {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

type ColorEntry = { key: number; count: number; lab: Lab };

export type Analysis = {
  source: ImageData;
  /** Unique opaque colors, most frequent first */
  colors: ColorEntry[];
};

export function analyzeImage(source: ImageData): Analysis {
  const src = source.data;
  const counts = new Map<number, number>();
  for (let o = 0; o < src.length; o += 4) {
    if (src[o + 3] === 0) continue;
    const key = (src[o] << 16) | (src[o + 1] << 8) | src[o + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const colors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      count,
      lab: rgbToLab(key >> 16, (key >> 8) & 255, key & 255),
    }));
  return { source, colors };
}

/** Assigns each unique color to a group. Returns group index per color entry. */
function groupColors(colors: ColorEntry[], threshold: number) {
  const seeds: Lab[] = [];
  const assignment = new Int32Array(colors.length);
  for (let i = 0; i < colors.length; i++) {
    const lab = colors[i].lab;
    let idx = -1;
    let best = threshold;
    for (let gi = 0; gi < seeds.length; gi++) {
      const d = deltaE(lab, seeds[gi]);
      if (d <= best) {
        best = d;
        idx = gi;
      }
    }
    if (idx === -1) {
      seeds.push(lab);
      idx = seeds.length - 1;
    }
    assignment[i] = idx;
  }
  return { assignment, groupCount: seeds.length };
}

/**
 * Merges the closest pair of groups until only `target` remain. A small step
 * in the grouping threshold can merge several colors at once, so the
 * threshold search alone can overshoot the requested count.
 */
function mergeClosestGroups(
  colors: ColorEntry[],
  assignment: Int32Array,
  groupCount: number,
  target: number,
) {
  const centers: Lab[] = Array.from({ length: groupCount }, () => [0, 0, 0]);
  const weights = new Float64Array(groupCount);
  for (let i = 0; i < colors.length; i++) {
    const g = assignment[i];
    const { lab, count } = colors[i];
    for (let c = 0; c < 3; c++) centers[g][c] += lab[c] * count;
    weights[g] += count;
  }
  for (let g = 0; g < groupCount; g++) for (let c = 0; c < 3; c++) centers[g][c] /= weights[g];

  const alive = new Uint8Array(groupCount).fill(1);
  const parent = Int32Array.from({ length: groupCount }, (_, g) => g);
  const nearest = new Int32Array(groupCount);
  const nearestDist = new Float64Array(groupCount);
  const updateNearest = (g: number) => {
    nearest[g] = -1;
    nearestDist[g] = Infinity;
    for (let h = 0; h < groupCount; h++) {
      if (h === g || !alive[h]) continue;
      const d = deltaE(centers[g], centers[h]);
      if (d < nearestDist[g]) {
        nearestDist[g] = d;
        nearest[g] = h;
      }
    }
  };
  for (let g = 0; g < groupCount; g++) updateNearest(g);

  for (let remaining = groupCount; remaining > target; remaining--) {
    let a = -1;
    for (let g = 0; g < groupCount; g++) {
      if (alive[g] && (a === -1 || nearestDist[g] < nearestDist[a])) a = g;
    }
    const b = nearest[a];
    const w = weights[a] + weights[b];
    for (let c = 0; c < 3; c++) {
      centers[a][c] = (centers[a][c] * weights[a] + centers[b][c] * weights[b]) / w;
    }
    weights[a] = w;
    alive[b] = 0;
    parent[b] = a;
    for (let g = 0; g < groupCount; g++) {
      if (!alive[g] || g === a) continue;
      if (nearest[g] === a || nearest[g] === b) {
        updateNearest(g);
      } else {
        const d = deltaE(centers[g], centers[a]);
        if (d < nearestDist[g]) {
          nearestDist[g] = d;
          nearest[g] = a;
        }
      }
    }
    updateNearest(a);
  }

  // Point every color at its surviving group, renumbered 0..target-1.
  const root = (g: number): number => (parent[g] === g ? g : (parent[g] = root(parent[g])));
  const index = new Int32Array(groupCount).fill(-1);
  let next = 0;
  for (let i = 0; i < colors.length; i++) {
    const r = root(assignment[i]);
    if (index[r] === -1) index[r] = next++;
    assignment[i] = index[r];
  }
  return next;
}

export type PaletteColor = { key: number; count: number };

export type SimplifyResult = {
  image: ImageData;
  /** Number of distinct colors in the output */
  colorCount: number;
  /** Distinct colors in the output, similar colors adjacent, dark to light */
  palette: PaletteColor[];
};

/**
 * Family grouping works on hue: each color becomes a point whose angle is its
 * hue and whose distance from the center grows with saturation up to
 * FAMILY_SATURATION, so a dull brown and a vivid orange of the same hue land
 * close together. Lightness counts for little, so dark and light shades of a
 * hue still share a family.
 */
const FAMILY_HUE_SCALE = 40;
const FAMILY_SATURATION = 15;
const FAMILY_LIGHTNESS_WEIGHT = 0.3;
/** Ward merge cost above which two groups stay separate families. */
const FAMILY_MAX_MERGE = 600;
/** Families whose average chroma is below this are treated as neutrals. */
const NEUTRAL_CHROMA = 8;
/** Hue (degrees) where the color wheel starts, just before red. */
const HUE_START = 10;

type Cluster = { center: Lab; size: number; members: number[]; alive: boolean; done: boolean };

/**
 * Orders colors the way a paint swatch chart would: similar colors are
 * grouped into hue families (so browns sit with oranges), neutrals come
 * first, families follow the color wheel, and each family runs dark to light.
 */
function orderByProximity(palette: PaletteColor[]): PaletteColor[] {
  const labs = palette.map(({ key }) => rgbToLab(key >> 16, (key >> 8) & 255, key & 255));
  const points = labs.map(([l, a, b]): Lab => {
    const s = Math.min(1, Math.hypot(a, b) / FAMILY_SATURATION);
    const h = Math.atan2(b, a);
    return [
      l * FAMILY_LIGHTNESS_WEIGHT,
      FAMILY_HUE_SCALE * s * Math.cos(h),
      FAMILY_HUE_SCALE * s * Math.sin(h),
    ];
  });

  // Ward agglomerative clustering using the nearest-neighbor chain algorithm,
  // stopping once the cheapest merge exceeds FAMILY_MAX_MERGE.
  const clusters: Cluster[] = points.map((center, i) => ({
    center,
    size: 1,
    members: [i],
    alive: true,
    done: false,
  }));
  const mergeCost = (a: Cluster, b: Cluster) => {
    const d = deltaE(a.center, b.center);
    return ((a.size * b.size) / (a.size + b.size)) * d * d;
  };
  const chain: number[] = [];
  for (;;) {
    if (chain.length === 0) {
      const start = clusters.findIndex((c) => c.alive && !c.done);
      if (start === -1) break;
      chain.push(start);
    }
    const top = chain[chain.length - 1];
    const prev = chain.length > 1 ? chain[chain.length - 2] : -1;
    let nearest = -1;
    let best = Infinity;
    for (let j = 0; j < clusters.length; j++) {
      const c = clusters[j];
      if (j === top || !c.alive || c.done) continue;
      const cost = mergeCost(clusters[top], c);
      if (cost < best || (cost === best && j === prev)) {
        best = cost;
        nearest = j;
      }
    }
    if (nearest === -1 || best > FAMILY_MAX_MERGE) {
      // Ward merge costs never shrink, so this cluster is a finished family.
      clusters[top].done = true;
      chain.length = 0;
    } else if (nearest === prev) {
      chain.length -= 2;
      const a = clusters[top];
      const b = clusters[nearest];
      const size = a.size + b.size;
      clusters.push({
        center: a.center.map((v, i) => (v * a.size + b.center[i] * b.size) / size) as Lab,
        size,
        members: [...a.members, ...b.members],
        alive: true,
        done: false,
      });
      a.alive = b.alive = false;
    } else {
      chain.push(nearest);
    }
  }

  const families = clusters
    .filter((c) => c.alive)
    .map(({ members }) => {
      let a = 0;
      let b = 0;
      for (const i of members) {
        a += labs[i][1];
        b += labs[i][2];
      }
      a /= members.length;
      b /= members.length;
      const hue = (Math.atan2(b, a) * 180) / Math.PI;
      return {
        members: [...members].sort((x, y) => labs[x][0] - labs[y][0]),
        rank: Math.hypot(a, b) < NEUTRAL_CHROMA ? -1 : (hue - HUE_START + 720) % 360,
      };
    })
    .sort((x, y) => x.rank - y.rank);

  return families.flatMap((f) => f.members.map((i) => palette[i]));
}

function countColors(image: ImageData): PaletteColor[] {
  const data = image.data;
  const counts = new Map<number, number>();
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] === 0) continue;
    const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

/**
 * Reduces the image to `targetCount` colors (or fewer, in the rare case that
 * two groups average to the same color). Returns the source unchanged if it
 * already has no more than `targetCount` colors.
 */
export function simplifyToColors(analysis: Analysis, targetCount: number): SimplifyResult {
  const { source, colors } = analysis;
  const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);

  if (targetCount >= colors.length) {
    return {
      image: out,
      colorCount: colors.length,
      palette: orderByProximity(colors.map(({ key, count }) => ({ key, count }))),
    };
  }

  // Binary search for the largest threshold that still yields >= targetCount groups.
  let lo = 0;
  let hi = 120;
  let best = groupColors(colors, 0);
  for (let iter = 0; iter < 14; iter++) {
    const mid = (lo + hi) / 2;
    const g = groupColors(colors, mid);
    if (g.groupCount >= targetCount) {
      best = g;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const { assignment } = best;
  const groupCount =
    best.groupCount > targetCount
      ? mergeClosestGroups(colors, assignment, best.groupCount, targetCount)
      : best.groupCount;
  const sums = new Float64Array(groupCount * 4);
  for (let i = 0; i < colors.length; i++) {
    const { key, count } = colors[i];
    const g = assignment[i] * 4;
    sums[g] += (key >> 16) * count;
    sums[g + 1] += ((key >> 8) & 255) * count;
    sums[g + 2] += (key & 255) * count;
    sums[g + 3] += count;
  }
  const mapping = new Map<number, [number, number, number]>();
  for (let i = 0; i < colors.length; i++) {
    const g = assignment[i] * 4;
    mapping.set(colors[i].key, [
      Math.round(sums[g] / sums[g + 3]),
      Math.round(sums[g + 1] / sums[g + 3]),
      Math.round(sums[g + 2] / sums[g + 3]),
    ]);
  }

  const src = source.data;
  const dst = out.data;
  for (let o = 0; o < src.length; o += 4) {
    if (src[o + 3] === 0) continue;
    const key = (src[o] << 16) | (src[o + 1] << 8) | src[o + 2];
    const [r, g, b] = mapping.get(key)!;
    dst[o] = r;
    dst[o + 1] = g;
    dst[o + 2] = b;
  }

  // Groups can occasionally average to the same color, so count the output.
  const palette = orderByProximity(countColors(out));
  return { image: out, colorCount: palette.length, palette };
}
