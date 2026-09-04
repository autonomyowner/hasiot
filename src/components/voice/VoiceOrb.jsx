import { useEffect, useRef } from 'react'

/**
 * The orb — a glossy iridescent sphere, not a flat disc.
 *
 * The look comes from three things layered in one fragment shader: a reconstructed
 * sphere normal so light behaves like it is wrapping a ball, a fresnel rim that
 * carries most of the colour, and a slow internal swirl sampled in surface space so
 * it reads as liquid under glass rather than a texture pasted on front.
 *
 * Audio arrives through `getLevel`, polled once per frame rather than passed as a
 * prop, so the orb never re-renders while the level changes sixty times a second.
 *
 * Falls back to a CSS sphere if WebGL is unavailable — the widget must still work.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;

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
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

  float t = uTime * mix(1.0, 0.22, uCalm);
  float level = uLevel;

  // The sphere swells slightly with the voice, and breathes when idle.
  float breathe = sin(t * 0.55) * 0.006 * (1.0 - uCalm);
  float R = 0.335 + uOpen * 0.02 + breathe + level * 0.028;

  float r = length(p);
  float d = r / R;

  // Reconstructed sphere normal — this is what makes light wrap instead of sit flat.
  float z = sqrt(max(0.0, 1.0 - d * d));
  vec3 N = normalize(vec3(p / max(R, 0.0001), z));
  vec3 V = vec3(0.0, 0.0, 1.0);

  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);

  // Internal swirl, sampled in surface space so it wraps with the sphere.
  vec2 sp = N.xy * (1.35 + N.z * 0.55);
  vec2 warp = vec2(fbm(sp * 2.1 + vec2(0.0, t * 0.13)),
                   fbm(sp * 2.1 + vec2(4.7, 2.1) - t * 0.11));
  float swirl = fbm(sp * 2.8 + warp * (1.5 + level * 1.1) + t * 0.07);

  // Palette: near-black core, teal through cyan, violet at the grazing edge.
  vec3 core   = vec3(0.016, 0.043, 0.075);
  vec3 teal   = vec3(0.043, 0.463, 0.435);
  vec3 cyan   = vec3(0.322, 0.886, 0.902);
  vec3 violet = vec3(0.502, 0.404, 0.925);

  vec3 col = core;
  col = mix(col, teal, smoothstep(0.12, 0.85, swirl) * (0.42 + level * 0.35));
  col = mix(col, cyan, smoothstep(0.55, 0.98, swirl + fres * 0.55) * (0.5 + level * 0.4));

  // Rim: the brightest thing on screen, and where the violet lives.
  vec3 rimCol = mix(cyan, violet, 0.35 + swirl * 0.45);
  col += rimCol * fres * (1.15 + level * 1.35);

  // A single specular highlight, upper-left, to sell the glass.
  vec3 L = normalize(vec3(-0.45, 0.62, 0.75));
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 26.0);
  col += vec3(0.85, 0.95, 1.0) * spec * 0.5;

  // Contact shadow at the lower edge keeps it from floating.
  col *= mix(1.0, 0.55, smoothstep(0.25, 1.0, -N.y) * 0.6);

  float body = smoothstep(1.005, 0.985, d);
  float halo = exp(-max(d - 1.0, 0.0) * 5.2) * (0.30 + level * 0.62);

  col += mix(cyan, violet, 0.4) * halo * 0.55;

  float alpha = clamp(body + halo * 0.75, 0.0, 1.0) * uOpen;
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
  const levelRef = useRef(getLevel)
  const openRef = useRef(open)
  levelRef.current = getLevel
  openRef.current = open

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!gl) {
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
      console.warn('[VoiceOrb] link failed:', gl.getProgramInfoLog(prog))
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
      const target = Math.min(1, Math.max(0, raw))
      // Fast attack, slow release — stops the orb strobing on consonants.
      smooth += (target - smooth) * (target > smooth ? 0.35 : 0.07)
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

    // An idle GPU loop behind a hidden tab is rude.
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
