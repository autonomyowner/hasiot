import { useEffect, useRef } from 'react'

/**
 * أبشر — the audio-reactive blob.
 *
 * A real 3D icosphere whose vertices are displaced along their normals by 3D simplex
 * noise, shaded as iridescent glass, with a two-pass bloom. Written against raw
 * WebGL2 rather than three.js / react-three-fiber on purpose: this sits in a section
 * of the landing page, so every visitor pays for it, and the page's whole budget is
 * ~75 kB gzip (see CLAUDE.md). The R3F stack would be several times the entire page.
 *
 * Audio arrives as `getFrequency`, a function returning 0..1, polled once per frame.
 * It is never a prop value and never React state — sixty updates a second through
 * React would re-render the tree for a number only the GPU reads.
 *
 * Renders nothing if WebGL2 is unavailable; the section keeps working without it.
 */

/* ---------- geometry: subdivided icosahedron ---------- */

function icosphere(detail) {
  const t = (1 + Math.sqrt(5)) / 2
  // prettier-ignore
  const base = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ]
  // prettier-ignore
  const faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ]

  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2])
    return [v[0] / l, v[1] / l, v[2] / l]
  }
  const mid = (a, b) => norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])

  let tris = faces.map((f) => f.map((i) => norm(base[i])))
  for (let d = 0; d < detail; d++) {
    const next = []
    for (const [a, b, c] of tris) {
      const ab = mid(a, b)
      const bc = mid(b, c)
      const ca = mid(c, a)
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca])
    }
    tris = next
  }

  const out = new Float32Array(tris.length * 9)
  let i = 0
  for (const tri of tris) for (const v of tri) { out[i++] = v[0]; out[i++] = v[1]; out[i++] = v[2] }
  return out
}

/* ---------- shaders ---------- */

const BLOB_VS = `#version 300 es
precision highp float;

in vec3 aPos;

uniform mat4  uProj;
uniform mat4  uView;
uniform float uTime;
uniform float uFreq;    // 0..1 audio amplitude
uniform float uCalm;

out vec3 vPos;          // view-space position
out vec3 vNrm;          // view-space normal, computed smoothly (never per-facet)
out vec3 vObj;          // object-space direction, for stable colour banding
out float vDisp;        // how far this vertex was pushed out

// Simplex 3D noise — Ashima Arts / Stefan Gustavson, the standard implementation.
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 nrm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= nrm.x; p1 *= nrm.y; p2 *= nrm.z; p3 *= nrm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

/**
 * Displacement at a point on the unit sphere.
 *
 * Every term is multiplied by uFreq, so at rest this returns exactly 0.0 and the
 * geometry is a perfect sphere. The blob only ever deforms because of the voice.
 */
float displacement(vec3 dir, float t, float freq) {
  if (freq <= 0.0) return 0.0;
  float slow = snoise(dir * 1.15 + vec3(0.0, t * 0.16, 0.0));
  float fast = snoise(dir * 2.60 + vec3(t * 0.42, 0.0, t * 0.30));
  // Tuned so loud speech ripples the surface and never dissolves the silhouette:
  // at full volume the radius varies by roughly a fifth, not a half.
  return (slow * 0.175 + fast * 0.075) * freq;
}

void main() {
  float t = uTime * mix(1.0, 0.25, uCalm);
  vec3 n = normalize(aPos);

  float disp = displacement(n, t, uFreq);
  vec3 displaced = n * (1.0 + disp);

  // Normals from two neighbours on the surface rather than from screen-space
  // derivatives. Derivatives give the *facet* normal, which on a smooth ball reads
  // as visible triangles — the faceting is unmissable once the sphere is perfect.
  // Sampling the same displacement function at two nearby points is smooth at rest
  // and still follows the ripples when the voice pushes them out.
  vec3 tangent = normalize(cross(abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), n));
  vec3 bitan = cross(n, tangent);
  const float E = 0.045;

  vec3 na = normalize(n + tangent * E);
  vec3 nb = normalize(n + bitan * E);
  vec3 pa = na * (1.0 + displacement(na, t, uFreq));
  vec3 pb = nb * (1.0 + displacement(nb, t, uFreq));

  vec3 nrm = normalize(cross(pa - displaced, pb - displaced));
  if (dot(nrm, n) < 0.0) nrm = -nrm;

  vec4 viewPos = uView * vec4(displaced, 1.0);
  vPos = viewPos.xyz;
  // uView is rotation + translation only, so its upper 3x3 transforms directions.
  vNrm = normalize(mat3(uView) * nrm);
  vObj = n;
  vDisp = disp;

  gl_Position = uProj * viewPos;
}
`

const BLOB_FS = `#version 300 es
precision highp float;

in vec3 vPos;
in vec3 vNrm;
in vec3 vObj;
in float vDisp;

uniform float uFreq;
uniform float uTime;

out vec4 outColor;

void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(-vPos);

  vec3 L = normalize(vec3(-0.45, 0.62, 0.66));

  // Tight fresnel: a rim, not a wash over the whole face. At 2.6 it bled across the
  // body and flattened everything into one mint silhouette.
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.2);
  float diff = max(dot(N, L), 0.0);
  float wrap = max(dot(N, L) * 0.5 + 0.5, 0.0);   // soft terminator, so no hard edge

  // Oasis palette rather than the usual neon: deep palm shadow through the brand
  // green to a spring cyan, with a date-gold catch-light only at grazing angles.
  vec3 deep  = vec3(0.004, 0.031, 0.028);
  vec3 green = vec3(0.043, 0.400, 0.310);
  vec3 mint  = vec3(0.325, 0.878, 0.706);
  vec3 gold  = vec3(0.945, 0.757, 0.396);

  // Iridescence travels with the surface and with how far it is pushed out, so the
  // colour moves when the voice does.
  float shift = (vObj.y * 0.5 + 0.5) * 0.45 + vDisp * 2.10 + fres * 0.30 + uTime * 0.03;

  // Body: dark by default and lit by the key, so the sphere has a light and a dark
  // side. Previously every term was additive and the whole surface sat at one value.
  vec3 col = mix(deep, green, wrap * wrap);
  col = mix(col, mint, smoothstep(0.55, 1.0, shift) * wrap * (0.45 + uFreq * 0.5));
  col += green * pow(diff, 1.8) * 0.55;

  // Rim, and the gold only in the last few degrees of grazing.
  col += mix(mint, vec3(0.88, 1.0, 0.96), 0.4) * fres * (1.35 + uFreq * 1.6);
  col += gold * smoothstep(0.55, 1.0, fres) * (0.25 + uFreq * 0.7);

  // Specular — a real highlight is what makes it read as glass rather than felt.
  vec3 H = normalize(L + V);
  col += vec3(0.85, 0.98, 0.94) * pow(max(dot(N, H), 0.0), 42.0) * (0.7 + uFreq * 0.6);

  // Crests glow: where the noise pushed furthest out, let a little light through.
  col += mint * smoothstep(0.05, 0.26, vDisp) * (0.20 + uFreq * 0.75);

  outColor = vec4(col, 1.0);
}
`

/** Fullscreen pass: 13-tap blur of the bright parts, added back over the sharp render. */
const POST_VS = `#version 300 es
precision highp float;
in vec2 aQuad;
out vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.0, 1.0);
}
`

const POST_FS = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uTexel;
out vec4 outColor;

vec3 bright(vec2 uv) {
  vec4 c = texture(uScene, uv);
  // Weighted by alpha so the empty background can never bloom, and only what is
  // already luminous does, which keeps the body defined.
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  return c.rgb * c.a * smoothstep(0.42, 0.95, l);
}

void main() {
  vec4 scene = texture(uScene, vUv);
  vec3 sharp = scene.rgb;

  // Two rings of taps at different radii — cheaper than a separable pass and, at
  // this blur width, indistinguishable.
  vec3 sum = bright(vUv) * 0.20;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;           // 60 degrees
    vec2 d1 = vec2(cos(a), sin(a)) * uTexel * 5.0;
    vec2 d2 = vec2(cos(a + 0.5236), sin(a + 0.5236)) * uTexel * 11.0;
    sum += bright(vUv + d1) * 0.085;
    sum += bright(vUv + d2) * 0.048;
  }

  vec3 col = sharp + sum * 1.6;

  // Gentle filmic shoulder so the brightest crests roll off instead of clipping.
  col = col / (col + vec3(0.85));
  col = pow(col, vec3(0.88));

  // The glow has to extend past the silhouette, so alpha is the body plus whatever
  // the bloom threw outside it. Premultiplied, because the canvas composites over
  // the section's own background rather than a black backdrop of its own.
  float glow = dot(sum, vec3(0.2126, 0.7152, 0.0722));
  float alpha = clamp(scene.a + glow * 2.4, 0.0, 1.0);
  outColor = vec4(col * alpha, alpha);
}
`

/* ---------- gl helpers ---------- */

function compile(gl, type, src, label) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn(`[VoiceBlob] ${label} failed:`, gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function program(gl, vsSrc, fsSrc, label) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, `${label} vertex`)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, `${label} fragment`)
  if (!vs || !fs) return null
  const p = gl.createProgram()
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn(`[VoiceBlob] ${label} link failed:`, gl.getProgramInfoLog(p))
    return null
  }
  return p
}

/** Column-major perspective and Y-rotation, so no matrix library is needed. */
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2)
  const nf = 1 / (near - far)
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ])
}

function viewMatrix(dist, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw)
  const cp = Math.cos(pitch), sp = Math.sin(pitch)
  // Rotate about Y then X, then translate back along -Z.
  // prettier-ignore
  return new Float32Array([
    cy,        sy * sp,       -sy * cp,      0,
    0,         cp,             sp,           0,
    sy,       -cy * sp,        cy * cp,      0,
    0,         0,             -dist,         1,
  ])
}

export default function VoiceBlob({ getFrequency, className = '' }) {
  const canvasRef = useRef(null)
  const freqRef = useRef(getFrequency)
  freqRef.current = getFrequency

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true })
    if (!gl) {
      canvas.classList.add('is-fallback')
      return
    }

    const blobProg = program(gl, BLOB_VS, BLOB_FS, 'blob')
    const postProg = program(gl, POST_VS, POST_FS, 'post')
    if (!blobProg || !postProg) {
      canvas.classList.add('is-fallback')
      return
    }

    // Geometry
    const verts = icosphere(5)
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(blobProg, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    // Fullscreen triangle for the bloom composite
    const quadVao = gl.createVertexArray()
    gl.bindVertexArray(quadVao)
    const quadVbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aQuad = gl.getAttribLocation(postProg, 'aQuad')
    gl.enableVertexAttribArray(aQuad)
    gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    // Offscreen target the blob renders into, so bloom has something to read.
    const fbo = gl.createFramebuffer()
    const tex = gl.createTexture()
    const depth = gl.createRenderbuffer()

    const u = {
      proj: gl.getUniformLocation(blobProg, 'uProj'),
      view: gl.getUniformLocation(blobProg, 'uView'),
      time: gl.getUniformLocation(blobProg, 'uTime'),
      freq: gl.getUniformLocation(blobProg, 'uFreq'),
      calm: gl.getUniformLocation(blobProg, 'uCalm'),
      fFreq: gl.getUniformLocation(blobProg, 'uFreq'),
    }
    const uf = {
      freq: gl.getUniformLocation(blobProg, 'uFreq'),
      time: gl.getUniformLocation(blobProg, 'uTime'),
    }
    const up = {
      scene: gl.getUniformLocation(postProg, 'uScene'),
      texel: gl.getUniformLocation(postProg, 'uTexel'),
    }

    let W = 0
    let H = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (w === W && h === H) return
      W = w
      H = h
      canvas.width = w
      canvas.height = h

      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      gl.bindRenderbuffer(gl.RENDERBUFFER, depth)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h)

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    const calmMq = window.matchMedia('(prefers-reduced-motion: reduce)')

    let raf = 0
    let running = true
    let smooth = 0
    let yaw = 0
    const start = performance.now()

    const frame = () => {
      if (!running) return
      resize()

      const raw = freqRef.current ? freqRef.current() : 0
      const target = Math.min(1, Math.max(0, raw))
      // Fast attack, slow release, so the blob lunges on a syllable and settles.
      smooth += (target - smooth) * (target > smooth ? 0.30 : 0.06)

      const t = (performance.now() - start) / 1000
      const calm = calmMq.matches ? 1 : 0
      yaw += (0.0016 + smooth * 0.006) * (calm ? 0.25 : 1)

      gl.enable(gl.DEPTH_TEST)
      gl.enable(gl.CULL_FACE)
      gl.cullFace(gl.BACK)

      // Pass 1 — blob into the offscreen target.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, W, H)
      gl.disable(gl.BLEND)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      gl.useProgram(blobProg)
      gl.uniformMatrix4fv(u.proj, false, perspective(0.82, W / H, 0.1, 20))
      gl.uniformMatrix4fv(u.view, false, viewMatrix(3.15, yaw, -0.22))
      gl.uniform1f(u.time, t)
      gl.uniform1f(uf.freq, smooth)
      gl.uniform1f(u.calm, calm)
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLES, 0, verts.length / 3)

      // Pass 2 — bloom composite to the screen.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, W, H)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.CULL_FACE)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(postProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(up.scene, 0)
      gl.uniform2f(up.texel, 1 / W, 1 / H)
      gl.bindVertexArray(quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      raf = requestAnimationFrame(frame)
    }

    // Only run while on screen — this is a section partway down a landing page, and
    // a idle GPU loop behind the fold is pure waste.
    let visible = false
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting
        if (visible && !raf && running) raf = requestAnimationFrame(frame)
        if (!visible && raf) { cancelAnimationFrame(raf); raf = 0 }
      },
      { threshold: 0.05 },
    )
    io.observe(canvas)

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0 }
      } else if (visible && !raf && running) {
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteProgram(blobProg)
      gl.deleteProgram(postProg)
      gl.deleteBuffer(vbo)
      gl.deleteBuffer(quadVbo)
      gl.deleteVertexArray(vao)
      gl.deleteVertexArray(quadVao)
      gl.deleteFramebuffer(fbo)
      gl.deleteTexture(tex)
      gl.deleteRenderbuffer(depth)
    }
  }, [])

  return <canvas ref={canvasRef} className={`va-blob ${className}`} aria-hidden="true" />
}
