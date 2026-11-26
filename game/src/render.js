// Drawing only: the world's state and the current screen in, pixels out.
// The camera chases the plane; the sea, islands, runway and rings are
// projected from world space with a simple perspective camera, and the plane
// itself is drawn in screen space at the centre of the frame. The HUD is a
// lit instrument panel: compass and altitude/speed tapes, an attitude
// indicator, throttle, a course minimap and the score.
import { FIELD, FONT, HULL, PALETTE } from './config.js';
import { groundKind, runwayCorners, terrainHeight } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEVEL = 'level';

const DEG = Math.PI / 180;
const FOV = 72 * DEG;
/** Rows of the terrain grid, in metres ahead of the camera. */
const GRID_ROWS = [35, 55, 80, 110, 150, 200, 260, 340, 440, 560, 700, 860];
const GRID_COLS = 15;
const GRID_SPREAD = 0.95;

const SEA = { deep: [13, 77, 122], shallow: [47, 143, 196] };
const LAND = {
  sand: [232, 210, 154],
  grass: [93, 162, 74],
  rock: [138, 127, 116],
  snow: [244, 248, 251],
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css(rgb, alpha = 1) {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;
}

/** Deterministic per-cell variation so the ground does not look flat. */
function cellHash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const focal = (FIELD.height / 2) / Math.tan(FOV / 2);
  const cx = FIELD.width / 2;
  const cy = FIELD.height / 2;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = 400) {
    const key = `${size}/${weight}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Camera basis from the smoothed chase camera in the world state. */
  function cameraBasis(cam) {
    const h = cam.heading * DEG;
    const p = cam.pitch * DEG;
    const roll = cam.bank * DEG;
    const ch = Math.cos(h);
    const sh = Math.sin(h);
    const cp = Math.cos(p);
    const sp = Math.sin(p);
    const fwd = [sh * cp, sp, ch * cp];
    const right = [ch, 0, -sh];
    const up = [-sh * sp, cp, -ch * sp];
    return { fwd, right, up, roll, heading: h, pitch: p };
  }

  /** Project a world point; null when behind the camera. */
  function project(p, cam, basis) {
    const dx = p.x - cam.x;
    const dy = p.y - cam.y;
    const dz = p.z - cam.z;
    let xc = dx * basis.right[0] + dy * basis.right[1] + dz * basis.right[2];
    let yc = dx * basis.up[0] + dy * basis.up[1] + dz * basis.up[2];
    const zc = dx * basis.fwd[0] + dy * basis.fwd[1] + dz * basis.fwd[2];
    if (zc < 2) return null;
    // Camera roll rotates the picture plane.
    const cr = Math.cos(basis.roll);
    const sr = Math.sin(basis.roll);
    const rx = xc * cr - yc * sr;
    const ry = xc * sr + yc * cr;
    xc = rx;
    yc = ry;
    return { x: cx + (xc * focal) / zc, y: cy - (yc * focal) / zc, z: zc };
  }

  function drawSky(state, basis) {
    const cam = state.camera;
    const horizonY = cy + focal * Math.tan(basis.pitch);
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(Math.max(0, Math.min(1, horizonY / FIELD.height)), PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyHorizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // The sun hangs ahead and to the right of the course.
    const sunDir = [0.42, 0.5, 0.77];
    const sunPoint = project(
      { x: cam.x + sunDir[0] * 4000, y: cam.y + sunDir[1] * 4000, z: cam.z + sunDir[2] * 4000 },
      cam, basis,
    );
    if (sunPoint) {
      const glow = context.createRadialGradient(sunPoint.x, sunPoint.y, 4, sunPoint.x, sunPoint.y, 90);
      glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 230, 150, 0.55)');
      glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
      context.fillStyle = glow;
      context.fillRect(sunPoint.x - 90, sunPoint.y - 90, 180, 180);
    }
    // Haze band at the horizon so the sea never meets the sky in a hard line.
    context.fillStyle = 'rgba(207, 230, 247, 0.55)';
    context.fillRect(0, horizonY - 14, FIELD.width, 28);
  }

  function drawPeaks(state, basis) {
    const cam = state.camera;
    for (const peak of state.course.peaks) {
      const base = project({ x: peak.x, y: 0, z: peak.z }, cam, basis);
      const apex = project({ x: peak.x, y: peak.height, z: peak.z }, cam, basis);
      if (!base || !apex) continue;
      const half = (peak.width * focal) / base.z / 2;
      if (apex.y > FIELD.height + 40 || base.x + half < -40 || base.x - half > FIELD.width + 40) continue;
      const haze = clamp(1 - base.z / 4200, 0.25, 0.85);
      context.fillStyle = css(mix([110, 118, 132], [207, 230, 247], 1 - haze), 0.9);
      context.beginPath();
      context.moveTo(base.x - half, base.y);
      context.lineTo(apex.x, apex.y);
      context.lineTo(base.x + half, base.y);
      context.closePath();
      context.fill();
      // Snow cap on the upper third.
      const capY = apex.y + (base.y - apex.y) * 0.32;
      const capHalf = half * 0.68;
      context.fillStyle = css(mix([244, 248, 251], [207, 230, 247], 1 - haze), 0.9);
      context.beginPath();
      context.moveTo(apex.x - capHalf, capY);
      context.lineTo(apex.x, apex.y);
      context.lineTo(apex.x + capHalf, capY);
      context.closePath();
      context.fill();
    }
  }

  function drawTerrain(state, basis) {
    const cam = state.camera;
    const course = state.course;
    const h = cam.heading * DEG;
    const sh = Math.sin(h);
    const ch = Math.cos(h);
    // Sample the grid in camera space, then project each vertex.
    const rows = [];
    for (let r = 0; r < GRID_ROWS.length; r += 1) {
      const zc = GRID_ROWS[r];
      const row = [];
      for (let c = 0; c < GRID_COLS; c += 1) {
        const xc = ((c / (GRID_COLS - 1)) * 2 - 1) * zc * GRID_SPREAD;
        const wx = cam.x + sh * zc + ch * xc;
        const wz = cam.z + ch * zc - sh * xc;
        const height = terrainHeight(wx, wz, course);
        const wy = height < 1.5 ? 0.3 : height;
        const p = project({ x: wx, y: wy, z: wz }, cam, basis);
        row.push({ p, height, xc, zc });
      }
      rows.push(row);
    }
    // Far rows first: painter's algorithm over the quads.
    for (let r = GRID_ROWS.length - 1; r > 0; r -= 1) {
      const far = rows[r];
      const near = rows[r - 1];
      for (let c = 0; c < GRID_COLS - 1; c += 1) {
        const a = far[c];
        const b = far[c + 1];
        const d = near[c + 1];
        const e = near[c];
        if (!a.p || !b.p || !d.p || !e.p) continue;
        const avgHeight = (a.height + b.height + d.height + e.height) / 4;
        const kind = groundKind(avgHeight);
        const vary = 0.92 + cellHash(Math.round(a.xc / 40), Math.round(a.zc / 40)) * 0.16;
        let rgb;
        if (kind === 'water') {
          const shallow = clamp(1 - avgHeight / 1.5, 0, 1) * 0.4 + (a.height < 0.6 ? 0.6 : 0.3);
          rgb = mix(SEA.deep, SEA.shallow, shallow);
        } else {
          rgb = LAND[kind].map((v) => v * vary);
        }
        // Distance haze washes far quads toward the horizon colour.
        const haze = clamp((a.zc - 320) / 620, 0, 0.55);
        rgb = mix(rgb, [207, 230, 247], haze);
        context.fillStyle = css(rgb);
        context.beginPath();
        context.moveTo(a.p.x, a.p.y);
        context.lineTo(b.p.x, b.p.y);
        context.lineTo(d.p.x, d.p.y);
        context.lineTo(e.p.x, e.p.y);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawClouds(state, basis) {
    const cam = state.camera;
    const list = [];
    for (const cloud of state.course.clouds) {
      const p = project(cloud, cam, basis);
      if (!p || p.x < -260 || p.x > FIELD.width + 260 || p.y < -120 || p.y > FIELD.height + 120) continue;
      list.push({ p, cloud });
    }
    // Farthest first so near clouds overlap far ones.
    list.sort((a, b) => b.p.z - a.p.z);
    for (const { p, cloud } of list) {
      const scale = (cloud.scale * focal) / p.z;
      const alpha = clamp(0.85 - p.z / 2600, 0.25, 0.85);
      context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      for (const [ox, oy, s] of [[-0.55, 0.08, 0.55], [0, -0.12, 0.75], [0.55, 0.06, 0.5], [0.15, 0.12, 0.6]]) {
        context.beginPath();
        context.ellipse(p.x + ox * scale, p.y + oy * scale, s * scale, s * scale * 0.42, 0, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawRunway(state, basis, runway, label) {
    const cam = state.camera;
    const corners = runwayCorners(runway).map((corner) => project(corner, cam, basis));
    if (corners.some((p) => p === null)) return;
    context.fillStyle = PALETTE.runway;
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) context.lineTo(corners[i].x, corners[i].y);
    context.closePath();
    context.fill();
    // Centreline dashes and threshold bars, sampled along the strip.
    const half = runway.length / 2;
    const cz = runway.z + half;
    context.fillStyle = PALETTE.runwayMark;
    for (let dz = -half + 18; dz < half - 10; dz += 34) {
      const a = project({ x: runway.x - 1.2, y: 0.7, z: cz + dz }, cam, basis);
      const b = project({ x: runway.x + 1.2, y: 0.7, z: cz + dz }, cam, basis);
      const c2 = project({ x: runway.x + 1.2, y: 0.7, z: cz + dz + 16 }, cam, basis);
      const d2 = project({ x: runway.x - 1.2, y: 0.7, z: cz + dz + 16 }, cam, basis);
      if (!a || !b || !c2 || !d2) continue;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c2.x, c2.y);
      context.lineTo(d2.x, d2.y);
      context.closePath();
      context.fill();
    }
    if (label) {
      const p = project({ x: runway.x, y: 2, z: cz + half + 30 }, cam, basis);
      if (p) text(label, p.x, p.y, 20, PALETTE.text, 'center', 700);
    }
  }

  function drawRings(state, basis) {
    const cam = state.camera;
    const course = state.course;
    const rings = course.rings;
    // Farthest first; the next ring is drawn last so its glow sits on top.
    const order = [];
    for (let i = 0; i < rings.length; i += 1) order.push(i);
    order.sort((a, b) => rings[b].z - rings[a].z);
    for (const i of order) {
      const ring = rings[i];
      const centre = project(ring, cam, basis);
      if (!centre) continue;
      const top = project({ x: ring.x, y: ring.y + ring.radius, z: ring.z }, cam, basis);
      if (!top) continue;
      const radiusPx = Math.abs(top.y - centre.y);
      if (radiusPx < 2 || radiusPx > 900) continue;
      const isNext = i === state.nextRing;
      const isDone = ring.passed;
      const color = isNext ? PALETTE.ringNext : isDone ? PALETTE.ringDone : PALETTE.ringFar;
      // A light beam down to the ground makes the ring findable from far off.
      const ground = project({ x: ring.x, y: terrainHeight(ring.x, ring.z, course) + 0.5, z: ring.z }, cam, basis);
      if (ground && isNext) {
        const beam = context.createLinearGradient(centre.x, centre.y, ground.x, ground.y);
        beam.addColorStop(0, 'rgba(255, 194, 51, 0.5)');
        beam.addColorStop(1, 'rgba(255, 194, 51, 0)');
        context.strokeStyle = beam;
        context.lineWidth = Math.max(1, radiusPx * 0.06);
        context.beginPath();
        context.moveTo(centre.x, centre.y);
        context.lineTo(ground.x, ground.y);
        context.stroke();
      }
      context.save();
      context.shadowColor = color;
      context.shadowBlur = isNext ? 22 : 8;
      context.strokeStyle = color;
      context.globalAlpha = isNext ? 1 : isDone ? 0.75 : 0.55;
      context.lineWidth = Math.max(2, radiusPx * 0.09);
      context.beginPath();
      context.arc(centre.x, centre.y, radiusPx, 0, Math.PI * 2);
      context.stroke();
      context.shadowBlur = 0;
      context.lineWidth = Math.max(1, radiusPx * 0.025);
      context.strokeStyle = 'rgba(255,255,255,0.85)';
      context.beginPath();
      context.arc(centre.x, centre.y, radiusPx * 0.86, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      if (isNext) {
        const dist = Math.max(0, Math.round(ring.z - state.plane.z));
        text(`RING ${i + 1}/${rings.length} · ${dist}m`, centre.x, centre.y - radiusPx - 12, 17, PALETTE.amber, 'center', 700);
      }
    }
  }

  /** The plane, drawn in screen space in chase view: nose up, tail down. */
  function drawPlane(state, time) {
    const p = state.plane;
    const bob = Math.sin(time * 2.1) * 2;
    const px = cx;
    const py = 452 + bob;
    const bankRad = p.bank * DEG;
    const pitchSquash = 1 - clamp(p.pitch, -30, 38) * 0.004;
    context.save();
    context.translate(px, py);
    context.rotate(bankRad * 0.9);
    context.scale(1, pitchSquash);
    // Contrails from the wingtips when the air is fast or the turn is hard.
    const trail = clamp((p.speed - 60) / 90, 0, 1) + Math.abs(p.bank) / 160;
    if (trail > 0.15 && !p.grounded) {
      context.strokeStyle = `rgba(255,255,255,${0.35 * trail})`;
      context.lineWidth = 3;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(side * 148, 18);
        context.lineTo(side * 168, 150);
        context.stroke();
      }
    }
    // Main wings: swept back, silver with a cyan tip light.
    const wingGrad = context.createLinearGradient(-150, 0, 150, 0);
    wingGrad.addColorStop(0, '#8fa8c4');
    wingGrad.addColorStop(0.5, '#dfe9f4');
    wingGrad.addColorStop(1, '#8fa8c4');
    context.fillStyle = wingGrad;
    context.beginPath();
    context.moveTo(-18, -18);
    context.lineTo(-152, 34);
    context.lineTo(-146, 46);
    context.lineTo(-14, 26);
    context.lineTo(14, 26);
    context.lineTo(146, 46);
    context.lineTo(152, 34);
    context.lineTo(18, -18);
    context.closePath();
    context.fill();
    // Tail wings and fin.
    context.fillStyle = '#6f87a3';
    context.beginPath();
    context.moveTo(-12, 38);
    context.lineTo(-58, 62);
    context.lineTo(-54, 70);
    context.lineTo(-10, 54);
    context.lineTo(10, 54);
    context.lineTo(54, 70);
    context.lineTo(58, 62);
    context.lineTo(12, 38);
    context.closePath();
    context.fill();
    // Fuselage: a sleek body, nose at the top.
    const bodyGrad = context.createLinearGradient(0, -96, 0, 62);
    bodyGrad.addColorStop(0, '#f4f8fc');
    bodyGrad.addColorStop(0.45, '#c3d4e6');
    bodyGrad.addColorStop(1, '#7e96b2');
    context.fillStyle = bodyGrad;
    context.beginPath();
    context.moveTo(0, -96);
    context.bezierCurveTo(13, -70, 15, -30, 12, 10);
    context.bezierCurveTo(11, 34, 9, 50, 7, 60);
    context.lineTo(-7, 60);
    context.bezierCurveTo(-9, 50, -11, 34, -12, 10);
    context.bezierCurveTo(-15, -30, -13, -70, 0, -96);
    context.closePath();
    context.fill();
    // Canopy glass.
    context.fillStyle = '#1d4e7a';
    context.beginPath();
    context.ellipse(0, -52, 6.5, 20, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(160, 220, 255, 0.7)';
    context.beginPath();
    context.ellipse(-1.5, -58, 2.4, 9, 0, 0, Math.PI * 2);
    context.fill();
    // Engine glow at the tail: brighter with throttle.
    const glow = 0.35 + p.throttle * 0.65;
    context.save();
    context.shadowColor = '#59d6ff';
    context.shadowBlur = 18 * glow;
    context.fillStyle = `rgba(120, 210, 255, ${0.55 * glow})`;
    context.beginPath();
    context.ellipse(0, 62, 7, 9 + 10 * p.throttle, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Wingtip lights.
    context.fillStyle = '#ff5a4e';
    context.beginPath();
    context.arc(-150, 40, 3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#7ddb8a';
    context.beginPath();
    context.arc(150, 40, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Invulnerability blink: the plane fades in and out after a crash.
    if (state.invulnerable > 0 && Math.floor(state.invulnerable * 8) % 2 === 0) {
      context.fillStyle = 'rgba(11, 21, 38, 0.35)';
      context.fillRect(px - 170, py - 110, 340, 260);
    }
  }

  function drawSpeedLines(state) {
    const p = state.plane;
    const intensity = clamp((p.speed - 115) / 45, 0, 1);
    if (intensity <= 0) return;
    context.strokeStyle = `rgba(255,255,255,${0.28 * intensity})`;
    context.lineWidth = 2;
    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (FIELD.width / 2 - 24 - ((i * 53) % 120));
      const y = 60 + ((i * 137) % 560);
      const len = 26 + intensity * 60;
      context.beginPath();
      context.moveTo(x + FIELD.width / 2, y);
      context.lineTo(x + FIELD.width / 2, y + len);
      context.stroke();
    }
  }

  // ---- HUD -----------------------------------------------------------------

  function drawCompass(state) {
    const heading = ((state.plane.heading % 360) + 360) % 360;
    const width = 440;
    const x0 = cx - width / 2;
    const y = 34;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x0 - 8, y - 20, width + 16, 34, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(x0, y - 20, width, 34);
    context.clip();
    const pxPerDeg = width / 120;
    const start = Math.floor((heading - 60) / 5) * 5;
    for (let deg = start; deg <= heading + 60; deg += 5) {
      const d = ((deg % 360) + 360) % 360;
      const dx = x0 + width / 2 + (deg - heading) * pxPerDeg;
      const major = d % 45 === 0;
      context.strokeStyle = major ? PALETTE.text : PALETTE.muted;
      context.lineWidth = major ? 2 : 1;
      context.beginPath();
      context.moveTo(dx, y + 8);
      context.lineTo(dx, y + (major ? -4 : 2));
      context.stroke();
      if (major) {
        const label = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[d];
        text(label, dx, y - 8, 14, PALETTE.text, 'center', 700);
      }
    }
    context.restore();
    // Centre caret and the heading readout.
    context.fillStyle = PALETTE.amber;
    context.beginPath();
    context.moveTo(cx - 7, y - 22);
    context.lineTo(cx + 7, y - 22);
    context.lineTo(cx, y - 13);
    context.closePath();
    context.fill();
    text(`${String(Math.round(heading)).padStart(3, '0')}°`, cx, y + 34, 16, PALETTE.amber, 'center', 700);
  }

  function drawTape(x, value, unit, label, format, range, step) {
    const height = 300;
    const y0 = 210;
    const y1 = y0 + height;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x - 46, y0 - 34, 92, height + 68, 8);
    context.fill();
    text(label, x, y0 - 42, 13, PALETTE.muted, 'center', 700);
    context.save();
    context.beginPath();
    context.rect(x - 46, y0, 92, height);
    context.clip();
    const pxPerUnit = height / range;
    const start = Math.floor((value - range / 2) / step) * step;
    for (let v = start; v <= value + range / 2; v += step) {
      if (v < 0) continue;
      const dy = y0 + height / 2 - (v - value) * pxPerUnit;
      context.strokeStyle = PALETTE.muted;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + 18, dy);
      context.lineTo(x + 34, dy);
      context.stroke();
      text(format(v), x - 6, dy + 5, 14, PALETTE.text, 'right');
    }
    context.restore();
    // Current value box.
    context.fillStyle = PALETTE.amber;
    context.beginPath();
    context.roundRect(x - 44, y0 + height / 2 - 16, 88, 32, 6);
    context.fill();
    text(format(value), x, y0 + height / 2 + 6, 17, '#101820', 'center', 700);
    text(unit, x, y1 + 26, 12, PALETTE.muted, 'center', 700);
  }

  function drawAttitude(state) {
    const p = state.plane;
    const ax = cx;
    const ay = 622;
    const r = 52;
    context.save();
    context.beginPath();
    context.arc(ax, ay, r, 0, Math.PI * 2);
    context.clip();
    // Sky and ground roll with the bank and slide with the pitch.
    context.translate(ax, ay);
    context.rotate(-p.bank * DEG);
    const pitchShift = clamp(p.pitch, -40, 40) * 1.15;
    context.translate(0, pitchShift);
    context.fillStyle = '#3f8fd2';
    context.fillRect(-r - 4, -r - 60, (r + 4) * 2, r + 60);
    context.fillStyle = '#8a6a45';
    context.fillRect(-r - 4, 0, (r + 4) * 2, r + 60);
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-r - 4, 0);
    context.lineTo(r + 4, 0);
    context.stroke();
    // Pitch ladder.
    context.lineWidth = 1;
    for (const deg of [-20, -10, 10, 20]) {
      const ly = -deg * 1.15;
      context.beginPath();
      context.moveTo(-18, ly);
      context.lineTo(18, ly);
      context.stroke();
    }
    context.restore();
    // Rim, fixed aircraft symbol and the vertical-speed needle.
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(ax, ay, r, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = PALETTE.amber;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(ax - 24, ay);
    context.lineTo(ax - 6, ay);
    context.moveTo(ax + 6, ay);
    context.lineTo(ax + 24, ay);
    context.moveTo(ax, ay - 3);
    context.lineTo(ax, ay + 3);
    context.stroke();
    text('ATT', ax, ay + r + 16, 11, PALETTE.muted, 'center', 700);
    // Vertical speed, in hundreds of feet per minute, beside the ball.
    const vsFpm = Math.round(p.verticalSpeed * 3.281 * 60);
    text(`VS ${vsFpm >= 0 ? '+' : ''}${vsFpm}`, ax + r + 10, ay + 4, 13, vsFpm >= 0 ? PALETTE.good : PALETTE.danger, 'left', 700);
  }

  function drawThrottle(state) {
    const p = state.plane;
    const x = 84;
    const y0 = 560;
    const height = 110;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x - 34, y0 - 30, 68, height + 44, 8);
    context.fill();
    text('THR', x, y0 - 14, 12, PALETTE.muted, 'center', 700);
    const fillH = height * p.throttle;
    const grad = context.createLinearGradient(0, y0 + height, 0, y0);
    grad.addColorStop(0, '#2c7a4b');
    grad.addColorStop(0.7, PALETTE.amber);
    grad.addColorStop(1, PALETTE.danger);
    context.fillStyle = grad;
    context.fillRect(x - 14, y0 + height - fillH, 28, fillH);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(x - 14, y0, 28, height);
    text(`${Math.round(p.throttle * 100)}%`, x, y0 + height + 16, 13, PALETTE.text, 'center', 700);
  }

  function drawTopLeft(state, best) {
    const minutes = Math.floor(Math.max(0, state.timeLeft) / 60);
    const seconds = Math.floor(Math.max(0, state.timeLeft) % 60);
    const timeText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(16, 14, 218, 108, 8);
    context.fill();
    text(`SCORE ${state.score}`, 30, 40, 20, PALETTE.text, 'left', 700);
    text(`BEST ${Math.max(best, state.score)}`, 30, 62, 14, PALETTE.muted, 'left');
    text(`LEVEL ${state.level}   RINGS ${state.ringsPassed}/${state.ringsTotal}`, 30, 86, 14, PALETTE.text, 'left', 700);
    text(`TIME ${timeText}`, 30, 110, 15, state.timeLeft < 30 ? PALETTE.danger : PALETTE.text, 'left', 700);
    // Hull: little jets, lit while the hull holds.
    for (let i = 0; i < HULL; i += 1) {
      const hx = 204 - i * 26;
      const hy = 34;
      context.fillStyle = i < state.hull ? PALETTE.cyan : 'rgba(90,110,130,0.4)';
      context.beginPath();
      context.moveTo(hx, hy - 8);
      context.lineTo(hx + 6, hy + 6);
      context.lineTo(hx, hy + 3);
      context.lineTo(hx - 6, hy + 6);
      context.closePath();
      context.fill();
    }
  }

  function drawMinimap(state) {
    const course = state.course;
    const w = 200;
    const h = 128;
    const x0 = FIELD.width - w - 16;
    const y0 = 14;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x0, y0, w, h, 8);
    context.fill();
    // Map the course's bounding box into the panel.
    const zs = course.rings.map((r) => r.z);
    const xs = course.rings.map((r) => r.x);
    const minX = Math.min(-80, ...xs) - 60;
    const maxX = Math.max(80, ...xs) + 60;
    const minZ = -80;
    const maxZ = course.finishZ + 120;
    const mx = (x) => x0 + 10 + ((x - minX) / (maxX - minX)) * (w - 20);
    const mz = (z) => y0 + 10 + ((z - minZ) / (maxZ - minZ)) * (h - 20);
    // Runways.
    context.fillStyle = PALETTE.runwayMark;
    context.fillRect(mx(course.startRunway.x) - 4, mz(course.startRunway.z) - 2, 8, 8);
    context.fillRect(mx(course.endRunway.x) - 4, mz(course.endRunway.z) - 2, 8, 8);
    // Course line and rings.
    context.strokeStyle = 'rgba(238, 244, 251, 0.55)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(mx(0), mz(0));
    for (const ring of course.rings) context.lineTo(mx(ring.x), mz(ring.z));
    context.lineTo(mx(course.endRunway.x), mz(course.endRunway.z));
    context.stroke();
    course.rings.forEach((ring, i) => {
      context.fillStyle = ring.passed ? PALETTE.ringDone : i === state.nextRing ? PALETTE.ringNext : PALETTE.ringFar;
      context.beginPath();
      context.arc(mx(ring.x), mz(ring.z), i === state.nextRing ? 4.5 : 3, 0, Math.PI * 2);
      context.fill();
    });
    // The plane.
    const px = mx(state.plane.x);
    const py = mz(state.plane.z);
    const heading = state.plane.heading * DEG;
    context.save();
    context.translate(px, py);
    context.rotate(heading);
    context.fillStyle = PALETTE.cyan;
    context.beginPath();
    context.moveTo(0, -7);
    context.lineTo(5, 5);
    context.lineTo(0, 2);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawNextRingArrow(state, basis) {
    const ring = state.course.rings[state.nextRing];
    if (!ring) return;
    const p = project(ring, state.camera, basis);
    if (p && p.x > 40 && p.x < FIELD.width - 40 && p.y > 60 && p.y < FIELD.height - 60) return;
    // The ring is off frame: point at it from the screen edge.
    const tx = p ? p.x : cx;
    const ty = p ? p.y : 200;
    const angle = Math.atan2(ty - 360, tx - cx);
    const ax = cx + Math.cos(angle) * 300;
    const ay = 360 + Math.sin(angle) * 200;
    const dist = Math.max(0, Math.round(ring.z - state.plane.z));
    context.save();
    context.translate(ax, ay);
    context.rotate(angle);
    context.fillStyle = PALETTE.ringNext;
    context.beginPath();
    context.moveTo(16, 0);
    context.lineTo(-10, -11);
    context.lineTo(-4, 0);
    context.lineTo(-10, 11);
    context.closePath();
    context.fill();
    context.restore();
    text(`${dist}m`, ax, ay + 26, 14, PALETTE.ringNext, 'center', 700);
  }

  function drawWarnings(state) {
    const p = state.plane;
    let warning = '';
    if (state.lowTerrain) warning = 'PULL UP';
    else if (state.stalling) warning = 'STALL — NOSE DOWN, MORE THROTTLE';
    if (!warning) return;
    const blink = Math.floor(performance.now() / 280) % 2 === 0;
    if (!blink) return;
    text(warning, cx, 150, 26, PALETTE.danger, 'center', 800);
  }

  function drawMessage(state) {
    if (!state.message) return;
    const alpha = clamp(state.messageTimer, 0, 1);
    context.globalAlpha = alpha;
    text(state.message, cx, 108, 30, PALETTE.amber, 'center', 800);
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    drawCompass(state);
    drawTape(74, state.plane.speed * 1.944, 'KTS', 'SPEED', (v) => String(Math.round(v)), 160, 20);
    drawTape(FIELD.width - 74, state.plane.y * 3.281, 'FT', 'ALTITUDE', (v) => String(Math.round(v)), 1600, 200);
    drawAttitude(state);
    drawThrottle(state);
    drawTopLeft(state, best);
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34 + 66;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    context.stroke();
    text(title, FIELD.width / 2, y + 72, 46, accent || PALETTE.text, 'center', 800);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 122 + i * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.amber, 'center', 700);
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen. */
  function draw(state, screen, best, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // A crash shakes the whole frame.
    if (state.shake > 0) {
      const s = state.shake * 9;
      context.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    const basis = cameraBasis(state.camera);
    drawSky(state, basis);
    drawPeaks(state, basis);
    drawTerrain(state, basis);
    drawClouds(state, basis);
    drawRunway(state, basis, state.course.startRunway, state.plane.grounded && screen === SCREEN_TITLE ? 'CLOUDGATE FIELD' : null);
    drawRunway(state, basis, state.course.endRunway, null);
    drawRings(state, basis);
    drawPlane(state, time);
    drawSpeedLines(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('CLOUDGATE', [
        'Sky Ring Run — thread every glowing ring over the islands,',
        'then bring her home on the far runway. Mind the hills.',
        'Steer ← → or A D · Climb ↑ or W · Descend ↓ or S',
        'Throttle Shift / Ctrl · Mouse steers too · P pause · M mute',
        best > 0 ? `Best score ${best}` : 'Your first flight awaits.',
      ], 'Press Space or click to fly', PALETTE.cyan);
      return;
    }
    drawHud(state, best);
    drawNextRingArrow(state, basis);
    drawWarnings(state);
    drawMessage(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The islands will wait for you.'], 'Press P or Space to keep flying');
    } else if (screen === SCREEN_OVER) {
      const lines = [
        `Score ${state.score}   ·   Best ${Math.max(best, state.score)}`,
        `Level ${state.level}   ·   Rings ${state.ringsPassed}/${state.ringsTotal}`,
        state.timeLeft <= 0 ? 'Out of time — the clock beat you home.' : 'Hull gone — the sea keeps the plane.',
      ];
      drawPanel('FLIGHT OVER', lines, 'Press Space or click to fly again', PALETTE.danger);
    } else if (screen === SCREEN_LEVEL) {
      drawPanel('LEVEL CLEAR', [
        `Score ${state.score}   ·   Rings ${state.ringsPassed}/${state.ringsTotal}`,
        'The next course is longer, the rings tighter, the clock meaner.',
      ], 'Next level in a moment…', PALETTE.good);
    }
    // Crash flash: a red blink over the frame.
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 60, 40, ${state.flash * 0.28})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    // A soft vignette so the lit instruments sit in a cockpit glow.
    const vignette = context.createRadialGradient(cx, cy, 300, cx, cy, 780);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(4,10,20,0.32)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
