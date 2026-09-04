import { useEffect, useRef } from 'react'

/**
 * The animated orb. A single full-quad fragment shader — no three.js, which would
 * cost more than the rest of the landing page put together.
 *
 * Audio drives it through `getLevel`, a function polled once per frame rather than a
 * prop, so the orb never re-renders while the level changes sixty times a second.
 * React state here would thrash the whole tree.
 *
 * Falls back to a CSS-only orb if WebGL is unavailable — the widget must still work.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision mediump float;

uniform vec2  uRes;
uniform float uTime;
uniform float uLevel;   // 0..1 smoothed audio amplitude
uniform float uOpen;    // 0..1 how "awake" the orb is
uniform float uCalm;    // 1.0 when prefers-reduced-motion

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

  float t = uTime * mix(1.0, 0.25, uCalm);
  float level = uLevel;

  // Domain warp — this is what stops it reading as a pulsing circle and starts it
  // reading as something with a surface.
  vec2 q = vec2(fbm(p * 2.2 + vec2(0.0, t * 0.18)),
                fbm(p * 2.2 + vec2(5.2, 1.3) - t * 0.14));
  float n = fbm(p * 2.6 + q * (1.1 + level * 0.9) + t * 0.08);

  float r = length(p);

  // The rim breathes on its own and swells with the voice.
  float breathe = sin(t * 0.7) * 0.012 * (1.0 - uCalm);
  float radius = 0.30 + uOpen * 0.06 + breathe + level * 0.075 + (n - 0.5) * (0.05 + level * 0.06);

  float core = smoothstep(radius, radius - 0.20, r);
  float rim  = smoothstep(radius + 0.015, radius - 0.045, r) - core * 0.55;
  float halo = exp(-max(r - radius, 0.0) * 7.0) * (0.32 + level * 0.55);

  vec3 deep = vec3(0.016, 0.208, 0.153);
  vec3 green = vec3(0.051, 0.478, 0.373);
  vec3 mint = vec3(0.361, 0.918, 0.702);
  vec3 gold = vec3(0.906, 0.729, 0.435);

  float grad = clamp(r / max(radius, 0.001), 0.0, 1.0);
  vec3 col = mix(deep, green, smoothstep(0.0, 0.75, grad + (n - 0.5) * 0.5));
  col = mix(col, mint, smoothstep(0.55, 1.05, grad + n * 0.35) * (0.55 + level * 0.45));

  // Gold only where the noise peaks, and only when there is voice — it should read
  // as light catching a surface, not as a second colour in the palette.
  col += gold * smoothstep(0.72, 0.96, n) * (0.10 + level * 0.55) * core;

  col += mint * rim * (0.35 + level * 0.5);
  col += mix(green, mint, 0.5) * halo * 0.85;

  float alpha = clamp(core * 0.98 + rim * 0.75 + halo * 0.6, 0.0, 1.0);
  alpha *= uOpen;

  gl_FragColor = vec4(col * alpha, alpha);
}
`

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[VoiceOrb] shader failed:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export default function VoiceOrb({ getLevel, open = true, className = '' }) {
  const canvasRef = useRef(null)
  const failedRef = useRef(false)
  // Read through refs so a changing level never re-renders React.
  const levelRef = useRef(getLevel)
  const openRef = useRef(open)
  levelRef.current = getLevel
  openRef.current = open

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
    if (!gl) {
      failedRef.current = true
      canvas.classList.add('is-fallback')
      return
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) {
      canvas.classList.add('is-fallback')
      return
    }

    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.classList.add('is-fallback')
      return
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uLevel = gl.getUniformLocation(prog, 'uLevel')
    const uOpen = gl.getUniformLocation(prog, 'uOpen')
    const uCalm = gl.getUniformLocation(prog, 'uCalm')

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const calmMq = window.matchMedia('(prefers-reduced-motion: reduce)')

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    let raf = 0
    let smooth = 0
    let openSmooth = 0
    const start = performance.now()
    let running = true

    const frame = () => {
      if (!running) return
      resize()

      const raw = levelRef.current ? levelRef.current() : 0
      // Fast attack, slow release — matches how a voice actually reads, and stops
      // the orb strobing on consonants.
      const target = Math.min(1, Math.max(0, raw))
      smooth += (target - smooth) * (target > smooth ? 0.35 : 0.08)
      openSmooth += ((openRef.current ? 1 : 0) - openSmooth) * 0.08

      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, (performance.now() - start) / 1000)
      gl.uniform1f(uLevel, smooth)
      gl.uniform1f(uOpen, openSmooth)
      gl.uniform1f(uCalm, calmMq.matches ? 1 : 0)

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }

    // Pause when the tab is hidden — an idle GPU loop on a landing page is rude.
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
  }, [])

  return <canvas ref={canvasRef} className={`va-orb ${className}`} aria-hidden="true" />
}
