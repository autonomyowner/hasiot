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

/** Two octaves only. Detail here reads as static, not as liquid. */
float flow(vec2 p) {
  return noise(p) * 0.65 + noise(p * 2.07 + vec2(3.1, 1.7)) * 0.35;
}

/**
 * Three fixed stops rather than a cosine palette. A cosine cycles through every hue,
 * which is where the yellow came from; this can only ever be teal, cyan or violet.
 * The argument must be a continuous function of the normal — never atan(), whose
 * wrap from +pi to -pi draws a hard seam straight down the sphere.
 */
vec3 pal(float x) {
  vec3 teal   = vec3(0.043, 0.396, 0.443);
  vec3 cyan   = vec3(0.376, 0.878, 0.925);
  vec3 violet = vec3(0.478, 0.404, 0.902);
  x = clamp(x, 0.0, 1.0);
  return x < 0.5
    ? mix(teal, cyan, smoothstep(0.0, 0.5, x))
    : mix(cyan, violet, smoothstep(0.5, 1.0, x));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

  float t = uTime * mix(1.0, 0.22, uCalm);
  float level = uLevel;

  float breathe = sin(t * 0.5) * 0.005 * (1.0 - uCalm);
  float R = 0.275 + uOpen * 0.015 + breathe + level * 0.024;

  float r = length(p);
  float d = r / R;

  float z = sqrt(max(0.0, 1.0 - min(d, 1.0) * min(d, 1.0)));
  vec3 N = normalize(vec3(p / max(R, 0.0001), z + 0.0001));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.42, 0.55, 0.72));

  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.6);
  float diff = max(dot(N, L), 0.0);

  // Sampled at very low frequency and in flat screen space, so it is two or three
  // soft blobs drifting across the whole ball — not a texture. Sampling in normal
  // space smears radially at the rim and reads as smoke, which is the thing that
  // made this look cheap.
  float cur = flow(p * 1.6 + vec2(t * 0.05, -t * 0.035)) - 0.5;

  // Hue travels along a tilted axis across the ball — continuous everywhere, so
  // there is no seam. Fresnel pushes the grazing edge toward violet, which is what
  // makes it read as a thin film over glass.
  float axis = dot(N, normalize(vec3(0.55, -0.72, 0.42))) * 0.5 + 0.5;
  float hue = clamp(axis * 0.55 + fres * 0.62 + cur * 0.10 + sin(t * 0.16) * 0.05, 0.0, 1.0);
  vec3 sheen = pal(hue);

  vec3 core = vec3(0.012, 0.036, 0.065);

  // The light lives INSIDE the glass, not on its edge. A soft source sits behind the
  // surface, up and to the left, and falls off exponentially in every direction — so
  // the brightness is a smooth gradient across the body with no ring anywhere.
  vec2 lp = vec2(-0.30, 0.26);
  float inner = exp(-length(N.xy - lp) * 1.75);
  // Ease it out before the silhouette so the glow never stacks into a rim.
  inner *= smoothstep(1.06, 0.45, d);

  vec3 col = core;
  col += sheen * inner * (1.05 + level * 0.95);

  // A second, deeper source further in, which keeps the centre from going flat as
  // the first one falls away.
  float deep = exp(-length(N.xy - lp * 0.35) * 3.1) * smoothstep(1.0, 0.2, d);
  col += mix(sheen, vec3(0.72, 0.93, 1.0), 0.30) * deep * (0.55 + level * 0.6);

  // Broad ambient wash so the unlit side is still glass rather than a void.
  col += sheen * pow(diff, 1.6) * 0.10;
  col += sheen * 0.05;

  // The rim is now only a whisper — enough to define the sphere's edge against the
  // background, far too faint to read as a ring of its own.
  float edge = fres * (0.25 + 0.75 * smoothstep(-0.5, 0.9, dot(N, L)));
  col += mix(sheen, vec3(0.80, 0.95, 1.0), 0.35) * edge * (0.30 + level * 0.35);

  // Gentle shade along the lower edge so it still reads as a ball.
  col *= mix(1.0, 0.74, smoothstep(0.05, 1.0, -N.y) * 0.5);

  float body = smoothstep(1.020, 0.965, d);
  // Falls to zero well inside the canvas, so no square edge can show.
  // Outside the sphere only. exp(-max(d-1,0)*k) is 1.0 for every d < 1, so without
  // this gate the glow was painted flat across the whole face and washed the dark
  // core out to mid-teal. The second gate is in screen radius, so the glow always
  // reaches zero before the canvas edge and cannot draw a rectangle.
  float halo = exp(-max(d - 1.0, 0.0) * 3.4)
             * smoothstep(0.930, 1.10, d)
             * smoothstep(0.495, 0.30, r);
  halo *= 0.34 + level * 0.5;

  col += mix(sheen, vec3(0.35, 0.6, 1.0), 0.4) * halo * 0.8;

  float alpha = clamp(body + halo * 0.8, 0.0, 1.0) * uOpen;
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
