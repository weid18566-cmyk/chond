// ╔══════════════════════════════════════════════════════════════════╗
// ║  WORMHOLE PHYSICS ENGINE — Morris-Thorne Metric Simulation      ║
// ║  A(Earth Sky) → B(Moon Surface) wormhole traversal              ║
// ╚══════════════════════════════════════════════════════════════════╝

// ── Wormhole Configuration Database ──
export const WORMHOLE_DB = {
  // Physical parameters (Morris-Thorne metric)
  throatRadius: 1.0,           // b₀: minimum wormhole radius (normalized)
  throatPosition: 0.5,         // throat center in normalized l-coordinate [0,1]
  throatWidth: 0.08,           // characteristic width of throat
  massParameter: 2.5,          // effective mass affecting curvature
  asymptoticFlatness: 1.0,     // flaring parameter at mouths

  // Coordinate mapping
  pointA: { name: '地球近地轨道', coord: 0.00, desc: 'Earth LEO', color: [0.2, 0.4, 1.0], skyType: 'earth' },
  pointB: { name: '月球轨道', coord: 1.00, desc: 'Moon Orbit', color: [0.6, 0.6, 0.7], skyType: 'moon' },

  // Travel parameters
  totalTravelDistance: 384400, // Earth-Moon distance in km
  throatDepth: 0.42,           // how deep into the wormhole the tunnel goes (normalized)
  traversalDuration: 12,       // base duration in seconds for full traversal

  // Interstellar movie parameters
  gravitationalLensingStrength: 1.5,
  tidalForceMultiplier: 2.0,
  dopplerShiftAmount: 0.8,
  einsteinRingIntensity: 0.6,
};

// ── Physics State ──
export function createWormholePhysics(config = {}) {
  const cfg = { ...WORMHOLE_DB, ...config };

  // Derived
  const throatCenter = cfg.throatPosition;
  const throatHalf = cfg.throatWidth / 2;
  const throatStart = throatCenter - throatHalf;
  const throatEnd = throatCenter + throatHalf;

  return {
    cfg,

    // ── Radial coordinate l to normalized position ──
    // l = 0 at Earth mouth, l = 1 at Moon mouth
    // Returns physics values for a given normalized position
    evaluate(l) {
      const t = Math.max(0, Math.min(1, l));

      // Distance from throat center
      const distFromThroat = Math.abs(t - throatCenter);
      const distFromThroatSq = distFromThroat * distFromThroat;

      // ── Throat radius (shape function) ──
      const throatFactor = 1 - Math.exp(-distFromThroatSq / (2 * cfg.throatWidth * cfg.throatWidth));
      const radius = cfg.throatRadius + (1 - cfg.throatRadius) * throatFactor;

      // ── Gravitational lensing (peaks at throat) ──
      const lensing = cfg.gravitationalLensingStrength *
        Math.exp(-distFromThroatSq / (0.01));

      // ── Tidal forces (peaks at throat edges) ──
      const tidal = cfg.tidalForceMultiplier *
        distFromThroatSq / (distFromThroatSq + 0.002);

      // ── Blue shift → Red shift transition ──
      // Blue shift when approaching throat, red shift when exiting
      const doppler = t < throatCenter
        ? -(1 - t / throatCenter) * cfg.dopplerShiftAmount  // blue shift entering
        : ((t - throatCenter) / (1 - throatCenter)) * cfg.dopplerShiftAmount * 0.7; // red shift exiting

      // ── Einstein ring intensity ──
      const ringIntensity = cfg.einsteinRingIntensity *
        Math.exp(-distFromThroatSq / 0.005);

      // ── Speed multiplier (faster near throat, slower at mouths) ──
      const speedMul = 0.5 + 2.0 * Math.exp(-distFromThroatSq / 0.05);

      // ── Camera shake amount (peaks at throat) ──
      const shake = 0.02 * tidal;

      // ── Color shift values ──
      // 0..1: entry cyan, 0.5: purple/white throat, 1: exit red/orange
      const colorPhase = t;

      // ── Tunnel wall deformation ──
      const wallDistortion = 0.3 * Math.exp(-distFromThroatSq / 0.03);

      return {
        l: t,
        radius,
        lensing,
        tidal,
        doppler,
        ringIntensity,
        speedMul,
        shake,
        colorPhase,
        wallDistortion,
        distFromThroat,
        inThroat: distFromThroat < throatHalf,
        approachingThroat: l < throatCenter,
        exitingThroat: l > throatCenter,
        atEarth: l < 0.05,
        atMoon: l > 0.95,
      };
    },

    // ── Get physical distance traveled ──
    getPhysicalDistance(l) {
      return l * cfg.totalTravelDistance;
    },

    // ── Get travel time estimate ──
    getTravelTimeRemaining(l, speed) {
      const remaining = (1 - l) * cfg.totalTravelDistance;
      return remaining / (speed * 10000); // seconds
    },

    // ── Get Earth→Moon position info ──
    getLocationInfo(l) {
      if (l < 0.1) return { label: '地球近地轨道', icon: 'public', type: 'earth' };
      if (l < 0.3) return { label: '虫洞入口 · 事件视界', icon: 'circle', type: 'transition' };
      if (l < 0.45) return { label: '虫洞隧道 · 接近喉部', icon: 'trip_origin', type: 'wormhole' };
      if (l < 0.55) return { label: '虫洞奇点 · 喉部', icon: 'brightness_7', type: 'singularity' };
      if (l < 0.75) return { label: '虫洞隧道 · 离开喉部', icon: 'trip_origin', type: 'wormhole' };
      if (l < 0.9) return { label: '虫洞出口 · 事件视界', icon: 'circle', type: 'transition' };
      return { label: '月球轨道', icon: 'dark_mode', type: 'moon' };
    },
  };
}
