// ╔════════════════════════════════════════════════════════════════════════╗
// ║  INTERSTELLAR WORMHOLE PHYSICS ENGINE v2.0                           ║
// ║  Enhanced Morris-Thorne metric with accretion physics,               ║
// ║  gravitational lensing, frame-dragging, tidal tensors                 ║
// ╚════════════════════════════════════════════════════════════════════════╝

export const WORMHOLE_DB = {
  // ── Morris-Thorne metric parameters ──
  throatRadius: 1.0,             // b₀: minimum wormhole radius
  throatPosition: 0.5,           // throat center in normalized l ∈ [0,1]
  throatWidth: 0.12,             // throat characteristic width (wider = more gradual)
  massParameter: 3.5,            // effective mass → curvature strength
  spinParameter: 0.3,             // Kerr-like spin (frame-dragging)
  asymptoticFlatness: 1.0,

  // ── Accretion disk parameters ──
  accretionInnerRadius: 1.2,      // ISCO (innermost stable circular orbit)
  accretionOuterRadius: 6.0,      // outer edge of accretion disk
  accretionTemperature: 12000,    // K — peak blackbody temperature
  accretionDensity: 0.8,          // relative density parameter

  // ── Travel parameters ──
  pointA: { name: '地球近地轨道', coord: 0.00, desc: 'Earth LEO', color: [0.2, 0.5, 1.0], skyType: 'earth' },
  pointB: { name: '月球轨道', coord: 1.00, desc: 'Moon Orbit', color: [0.7, 0.65, 0.7], skyType: 'moon' },
  totalTravelDistance: 384400,
  traversalDuration: 14,

  // ── Interstellar visual parameters ──
  gravitationalLensingStrength: 2.8,
  tidalForceMultiplier: 3.5,
  dopplerShiftAmount: 1.2,
  einsteinRingIntensity: 1.0,
  photonSphereRadius: 1.5,        // r = 1.5 * r_s for Schwarzschild
  frameDragStrength: 0.4,

  // ── Volumetric parameters ──
  volumetricDensity: 0.6,
  scatteringCoeff: 2.5,
  absorptionCoeff: 0.15,
};

// ── Helper: Gaussian profile ──
function gaussian(x, sigma) {
  const s2 = sigma * sigma;
  return Math.exp(-x * x / (2 * s2));
}

// ── Helper: Lorentzian profile ──
function lorentzian(x, gamma) {
  return (gamma * gamma) / (x * x + gamma * gamma);
}

export function createWormholePhysics(config = {}) {
  const cfg = { ...WORMHOLE_DB, ...config };

  const throatCenter = cfg.throatPosition;
  const throatHalf = cfg.throatWidth / 2;

  return {
    cfg,

    // ══════════════════════════════════════════════════════════════
    //  evaluate(l) — Core physics evaluation at normalized position l
    // ══════════════════════════════════════════════════════════════
    evaluate(l) {
      const t = Math.max(0, Math.min(1, l));
      const distFromThroat = Math.abs(t - throatCenter);
      const distSq = distFromThroat * distFromThroat;

      // ── Throat radius (proper Morris-Thorne embedding function) ──
      // r(l) = b₀ + (r_max - b₀) * (1 - exp(-d²/(2w²)))
      const throatFactor = 1 - Math.exp(-distSq / (2 * cfg.throatWidth * cfg.throatWidth));
      const radius = cfg.throatRadius + (1 - cfg.throatRadius) * throatFactor;

      // ── Embedding diagram curvature (d²r/dl²) ──
      const curvature = throatFactor * (1 - throatFactor) / (cfg.throatWidth * cfg.throatWidth);

      // ── Gravitational lensing (peaks sharply at throat) ──
      const lensing = cfg.gravitationalLensingStrength * gaussian(distFromThroat, 0.08);

      // ── Tidal forces (Lorentzian — peaks at throat edges, not center) ──
      const tidal = cfg.tidalForceMultiplier * lorentzian(distFromThroat - cfg.throatWidth * 0.4, 0.015);

      // ── Tidal tensor eigenvalues (radial vs tangential) ──
      const tidalRadial = tidal * (1 + 0.5 * Math.sin(t * 20));
      const tidalTangential = tidal * 0.7;

      // ── Doppler shift (blue entering → white throat → red exiting) ──
      let doppler;
      if (t < throatCenter) {
        const f = t / throatCenter;
        doppler = -cfg.dopplerShiftAmount * Math.pow(1 - f, 1.5);
      } else {
        const f = (t - throatCenter) / (1 - throatCenter);
        doppler = cfg.dopplerShiftAmount * 0.8 * Math.pow(f, 1.2);
      }

      // ── Relativistic beaming factor ──
      const speedMul = 0.4 + 2.5 * gaussian(distFromThroat, 0.15);
      const gamma = 1 / Math.sqrt(Math.max(0.01, 1 - speedMul * 0.1));
      const beaming = Math.pow(gamma, 3) * 0.3;

      // ── Einstein ring intensity ──
      const ringIntensity = cfg.einsteinRingIntensity * gaussian(distFromThroat, 0.06);

      // ── Photon sphere influence (visible as bright ring) ──
      const photonSphere = gaussian(distFromThroat - 0.03, 0.04) * 0.8;

      // ── Speed multiplier already computed above for gamma ──

      // ── Frame-dragging (Lense-Thirring effect) ──
      const frameDrag = cfg.frameDragStrength * gaussian(distFromThroat, 0.1) *
        (t < throatCenter ? 1 : -1);

      // ── Camera shake (proportional to tidal stress) ──
      const shake = 0.03 * tidal;

      // ── Wall distortion ──
      const wallDistortion = 0.5 * gaussian(distFromThroat, 0.15);

      // ── Accretion disk brightness ──
      const accretionBrightness = cfg.accretionDensity *
        gaussian(radius - cfg.accretionInnerRadius, 0.8);

      // ── Volumetric scattering ──
      const volumetricScatter = cfg.volumetricDensity *
        gaussian(distFromThroat, 0.2);

      // ── Chromatic aberration (strong near throat) ──
      const chromaticAberration = 0.008 * gaussian(distFromThroat, 0.06);

      // ── Color phase ──
      const colorPhase = t;

      // ── Gravitational redshift ──
      const gravitationalRedshift = 1 - Math.exp(-2 * cfg.massParameter / Math.max(radius, 0.1));

      return {
        l: t,
        radius,
        curvature,
        lensing,
        tidal,
        tidalRadial,
        tidalTangential,
        doppler,
        beaming,
        ringIntensity,
        photonSphere,
        speedMul,
        frameDrag,
        shake,
        colorPhase,
        wallDistortion,
        accretionBrightness,
        volumetricScatter,
        chromaticAberration,
        gravitationalRedshift,
        gamma,
        distFromThroat,
        inThroat: distFromThroat < throatHalf,
        nearThroat: distFromThroat < cfg.throatWidth * 2,
        approachingThroat: t < throatCenter,
        exitingThroat: t > throatCenter,
        atEarth: l < 0.05,
        atMoon: l > 0.95,
      };
    },

    getPhysicalDistance(l) { return l * cfg.totalTravelDistance; },

    getTravelTimeRemaining(l, speed) {
      return ((1 - l) * cfg.totalTravelDistance) / (speed * 10000);
    },

    getLocationInfo(l) {
      if (l < 0.08) return { label: '地球近地轨道 · 虫洞入口', icon: 'public', type: 'earth' };
      if (l < 0.22) return { label: '事件视界 · 空间扭曲开始', icon: 'circle', type: 'horizon' };
      if (l < 0.38) return { label: '虫洞隧道 · 接近喉部', icon: 'trip_origin', type: 'tunnel' };
      if (l < 0.48) return { label: '光子球 · 极端弯曲', icon: 'brightness_7', type: 'photon' };
      if (l < 0.55) return { label: '虫洞奇点 · 喉部穿越', icon: 'flare', type: 'singularity' };
      if (l < 0.65) return { label: '光子球 · 反向弯曲', icon: 'brightness_7', type: 'photon' };
      if (l < 0.78) return { label: '虫洞隧道 · 离开喉部', icon: 'trip_origin', type: 'tunnel' };
      if (l < 0.92) return { label: '事件视界 · 空间还原中', icon: 'circle', type: 'horizon' };
      return { label: '月球轨道 · 即将抵达', icon: 'dark_mode', type: 'moon' };
    },
  };
}
