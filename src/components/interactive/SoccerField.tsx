"use client"
import { useEffect, useMemo, useRef, useState } from "react"
type Vec = { x: number; y: number }
type Team = "blue" | "red"
type Role = "gk" | "def" | "mid" | "fwd"
type Player = {
  id: string
  team: Team
  role: Role
  pos: Vec
  vel: Vec
  laneTarget?: Vec
  kickCd?: number // ms cooldown after kicking
  isUser?: boolean
}
const FIELD = {
  w: 1600,
  h: 1000,
  x: 80,
  y: 80,
  wInner: 1440,
  hInner: 840,
}
const GOAL_MOUTH = { y1: FIELD.h / 2 - 80, y2: FIELD.h / 2 + 80 }
const LEFT_LINE = FIELD.x
const RIGHT_LINE = FIELD.x + FIELD.wInner
// ---------- vector helpers ----------
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const len = (v: Vec) => Math.hypot(v.x, v.y)
const add = (a: Vec, b: Vec) => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Vec, b: Vec) => ({ x: a.x - b.x, y: a.y - b.y })
const mul = (a: Vec, k: number) => ({ x: a.x * k, y: a.y * k })
const norm = (v: Vec) => {
  const L = len(v) || 1
  return { x: v.x / L, y: v.y / L }
}
function baseKickoff(): Player[] {
  const B: Player[] = [
    { id: "b-gk", team: "blue", role: "gk", pos: { x: FIELD.x + 90, y: 500 }, vel: { x: 0, y: 0 } },
    { id: "b-d1", team: "blue", role: "def", pos: { x: FIELD.x + 260, y: 320 }, vel: { x: 0, y: 0 } },
    { id: "b-d2", team: "blue", role: "def", pos: { x: FIELD.x + 260, y: 680 }, vel: { x: 0, y: 0 } },
    { id: "b-m1", team: "blue", role: "mid", pos: { x: FIELD.x + 520, y: 500 }, vel: { x: 0, y: 0 } },
    { id: "b-m2", team: "blue", role: "mid", pos: { x: FIELD.x + 620, y: 320 }, vel: { x: 0, y: 0 } },
    { id: "b-f1", team: "blue", role: "fwd", pos: { x: FIELD.x + 840, y: 500 }, vel: { x: 0, y: 0 } },
  ]
  const R: Player[] = [
    { id: "r-gk", team: "red", role: "gk", pos: { x: RIGHT_LINE - 90, y: 500 }, vel: { x: 0, y: 0 } },
    { id: "r-d1", team: "red", role: "def", pos: { x: RIGHT_LINE - 260, y: 320 }, vel: { x: 0, y: 0 } },
    { id: "r-d2", team: "red", role: "def", pos: { x: RIGHT_LINE - 260, y: 680 }, vel: { x: 0, y: 0 } },
    { id: "r-m1", team: "red", role: "mid", pos: { x: RIGHT_LINE - 520, y: 500 }, vel: { x: 0, y: 0 } },
    { id: "r-m2", team: "red", role: "mid", pos: { x: RIGHT_LINE - 620, y: 320 }, vel: { x: 0, y: 0 } },
    { id: "r-f1", team: "red", role: "fwd", pos: { x: RIGHT_LINE - 840, y: 500 }, vel: { x: 0, y: 0 } },
  ]
  const all = [...B, ...R]
  for (const p of all) {
    p.laneTarget = {
      x: clamp(p.pos.x + rand(-80, 80), FIELD.x + 40, FIELD.x + FIELD.wInner - 40),
      y: clamp(p.pos.y + rand(-140, 140), FIELD.y + 40, FIELD.y + FIELD.hInner - 40),
    }
  }
  return all
}
export default function SoccerField() {
  // --- control which team user is on (default blue) ---
  const [userTeam, setUserTeam] = useState<Team>("blue")
  const USER_ID = "user-player"
  // --- input state (keyboard) ---
  const keysRef = useRef({
    up: false, down: false, left: false, right: false,
    shoot: false, shift: false,
  })
  // --- layout refs & mouse handling ---
  const svgRef = useRef<SVGSVGElement>(null)
  const [hovering, setHovering] = useState(false)
  const [cursorVb, setCursorVb] = useState<Vec | null>(null)
  const toVb = (clientX: number, clientY: number): Vec | null => {
    const svg = svgRef.current
    if (!svg) return null
    const r = svg.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * FIELD.w
    const y = ((clientY - r.top) / r.height) * FIELD.h
    return { x, y }
  }
  // --- state: ball, players, score, goal flash ---
  const kickoffWithUser = (team: Team) => {
    const base = baseKickoff()
    const startPos =
      team === "blue"
        ? { x: FIELD.x + 780, y: 500 }
        : { x: RIGHT_LINE - 780, y: 500 }
    base.push({
      id: USER_ID,
      team,
      role: "fwd",
      pos: startPos,
      vel: { x: 0, y: 0 },
      isUser: true,
    })
    return base
  }
  const [players, setPlayers] = useState<Player[]>(() => kickoffWithUser(userTeam))
  const [ball, setBall] = useState<{ pos: Vec; vel: Vec }>({
    pos: { x: FIELD.w / 2, y: FIELD.h / 2 },
    vel: { x: 0, y: 0 },
  })
  const [trail, setTrail] = useState<Vec[]>([])
  const [score, setScore] = useState<{ blue: number; red: number }>({ blue: 0, red: 0 })
  const [flash, setFlash] = useState<{ show: boolean; text: string }>({ show: false, text: "" })
  const [kickoffSide, setKickoffSide] = useState<Team>("blue") // who starts next
  // latest refs for loop
  const playersRef = useRef(players); playersRef.current = players
  const ballRef = useRef(ball); ballRef.current = ball
  const trailRef = useRef(trail); trailRef.current = trail
  const userTeamRef = useRef(userTeam); userTeamRef.current = userTeam
  // helpers
  const resetKickoff = (nextKickoff: Team) => {
    setPlayers(kickoffWithUser(userTeamRef.current))
    setBall({ pos: { x: FIELD.w / 2, y: FIELD.h / 2 }, vel: { x: 0, y: 0 } })
    setTrail([])
    setKickoffSide(nextKickoff)
  }
  // keyboard listeners
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault()
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keysRef.current.up = true
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keysRef.current.down = true
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keysRef.current.left = true
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = true
      if (e.key === " ") keysRef.current.shoot = true
      if (e.key === "Shift") keysRef.current.shift = true
      if (e.key === "t" || e.key === "T") {
        // quick toggle team
        setUserTeam((prev) => prev === "blue" ? "red" : "blue")
        // re-seed positions with the user on the new side
        setPlayers(kickoffWithUser(userTeamRef.current === "blue" ? "red" : "blue"))
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keysRef.current.up = false
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keysRef.current.down = false
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keysRef.current.left = false
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = false
      if (e.key === " ") keysRef.current.shoot = false
      if (e.key === "Shift") keysRef.current.shift = false
    }
    window.addEventListener("keydown", down, { passive: false })
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down as any)
      window.removeEventListener("keyup", up as any)
    }
  }, [])
  // keep userTeam ref synced
  useEffect(() => { userTeamRef.current = userTeam }, [userTeam])
  // --- animation loop (AI + physics + user control) ---
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let ballTouchCd = 0
    const step = (t: number) => {
      const dt = Math.min(0.04, (t - last) / 1000)
      last = t
      ballTouchCd = Math.max(0, ballTouchCd - dt * 1000)
      // === BALL ===
      const b = { ...ballRef.current }
      const friction = 0.985
      if (hovering && cursorVb) {
        const toC = sub(cursorVb, b.pos)
        const desired = mul(norm(toC), Math.min(400, 80 + len(toC) * 1.2))
        const steer = mul(sub(desired, b.vel), 0.25)
        b.vel = add(b.vel, mul(steer, dt))
      }
      // === PLAYERS ===
      const P = playersRef.current.map((p) => ({
        ...p,
        pos: { ...p.pos },
        vel: { ...p.vel },
        kickCd: Math.max(0, (p.kickCd || 0) - dt * 1000),
      }))
      const interestR = 230
      const avoidR = 42
      const accel = 520
      const maxSpeed: Record<Role, number> = { gk: 220, def: 240, mid: 280, fwd: 310 }
      const maxKick = 980
      const passPower = 720
      const dribblePower = 420
      const shootPower = 920
      // teammate picker
      const choosePass = (self: Player) => {
        const dir = self.team === "blue" ? 1 : -1
        let best: Player | null = null
        let bestScore = -1
        for (const q of P) {
          if (q.team !== self.team || q.id === self.id) continue
          const ahead = (q.pos.x - self.pos.x) * dir
          if (ahead < -60) continue
          const d = len(sub(q.pos, self.pos))
          if (d > 420) continue
          const score = ahead - d * 0.2 + rand(-20, 20)
          if (score > bestScore) { best = q; bestScore = score }
        }
        return best
      }
      // move players
      for (let i = 0; i < P.length; i++) {
        const p = P[i]
        // USER-CONTROL override
        if (p.isUser) {
          const inputX = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0)
          const inputY = (keysRef.current.down ? 1 : 0) - (keysRef.current.up ? 1 : 0)
          const input = { x: inputX, y: inputY }
          const hasInput = inputX !== 0 || inputY !== 0
          // sprint modifier
          const sprint = keysRef.current.shift ? 1.22 : 1.0
          const targetSpeed = maxSpeed[p.role] * 1.08 * sprint // user slightly faster ⚡
          const desiredVel = hasInput ? mul(norm(input), targetSpeed) : mul(p.vel, 0.9) // glide to stop
          const steer = sub(desiredVel, p.vel)
          const limit = accel * (keysRef.current.shift ? 1.25 : 1.0)
          const steerClipped = mul(norm(steer), Math.min(limit, len(steer)))
          p.vel = add(p.vel, mul(steerClipped, dt))
          const s = len(p.vel)
          const sMax = targetSpeed
          if (s > sMax) p.vel = mul(p.vel, sMax / s)
          p.pos = add(p.pos, mul(p.vel, dt))
          p.pos.x = clamp(p.pos.x, FIELD.x + 18, RIGHT_LINE - 18)
          p.pos.y = clamp(p.pos.y, FIELD.y + 18, FIELD.y + FIELD.hInner - 18)
          // also keep some light auto-avoid to reduce clipping
          for (let j = 0; j < P.length; j++) {
            if (i === j) continue
            const diff = sub(p.pos, P[j].pos)
            const d = len(diff)
            if (d < avoidR && d > 1) {
              const push = mul(norm(diff), (avoidR - d) * 0.9)
              p.pos = add(p.pos, mul(push, dt))
            }
          }
          continue
        }
        // AI for non-user
        const toBall = sub(b.pos, p.pos)
        const dBall = len(toBall)
        if (!p.laneTarget || Math.random() < 0.0025) {
          p.laneTarget = {
            x: clamp(p.pos.x + rand(-120, 120), FIELD.x + 40, FIELD.x + FIELD.wInner - 40),
            y: clamp(p.pos.y + rand(-160, 160), FIELD.y + 40, FIELD.y + FIELD.hInner - 40),
          }
        }
        let desired = sub(p.laneTarget, p.pos)
        if (p.role === "gk") {
          const homeX = p.team === "blue" ? FIELD.x + 90 : RIGHT_LINE - 90
          const homeY = clamp(b.pos.y, FIELD.y + 180, FIELD.y + FIELD.hInner - 180)
          desired = { x: homeX - p.pos.x, y: (homeY - p.pos.y) * 0.6 }
        }
        if (dBall < interestR) desired = add(mul(desired, 0.5), mul(norm(toBall), 120))
        let avoid = { x: 0, y: 0 }
        for (let j = 0; j < P.length; j++) {
          if (i === j) continue
          const diff = sub(p.pos, P[j].pos)
          const d = len(diff)
          if (d < avoidR && d > 1) avoid = add(avoid, mul(norm(diff), (avoidR - d) * 2.2))
        }
        const desiredVel = add(mul(norm(desired), maxSpeed[p.role]), avoid)
        const steer = sub(desiredVel, p.vel)
        const steerClipped = mul(norm(steer), Math.min(accel, len(steer)))
        p.vel = add(p.vel, mul(steerClipped, dt))
        const s = len(p.vel)
        const sMax = maxSpeed[p.role]
        if (s > sMax) p.vel = mul(p.vel, sMax / s)
        p.pos = add(p.pos, mul(p.vel, dt))
        p.pos.x = clamp(p.pos.x, FIELD.x + 18, RIGHT_LINE - 18)
        p.pos.y = clamp(p.pos.y, FIELD.y + 18, FIELD.y + FIELD.hInner - 18)
      }
      // ball control & kicking
      const controlR = 24
      if (ballTouchCd <= 0) {
        let owner: Player | null = null
        let bestD = controlR
        for (const p of P) {
          const d = len(sub(b.pos, p.pos))
          if (d < bestD) { bestD = d; owner = p }
        }
        if (owner && (owner.kickCd || 0) <= 0) {
          const attackingRight = owner.team === "blue"
          const theirGoalX = attackingRight ? RIGHT_LINE + 8 : LEFT_LINE - 8
          const inLane =
            (attackingRight ? b.pos.x > FIELD.w / 2 : b.pos.x < FIELD.w / 2) &&
            b.pos.y > GOAL_MOUTH.y1 - 160 && b.pos.y < GOAL_MOUTH.y2 + 160
          // user can force shoot with SPACE
          const userWantsShoot = owner.isUser && keysRef.current.shoot
          const shootChance = inLane ? 0.6 : 0.2
          const willShoot = userWantsShoot || Math.random() < shootChance
          let kick: Vec
          if (willShoot) {
            const targetY = clamp(FIELD.h / 2 + rand(-60, 60), GOAL_MOUTH.y1 + 10, GOAL_MOUTH.y2 - 10)
            const toGoal = norm({ x: theirGoalX - b.pos.x, y: targetY - b.pos.y })
            const power = owner.isUser && keysRef.current.shoot ? shootPower + 120 : shootPower
            kick = mul(toGoal, power + rand(-60, 60))
          } else {
            const mate = choosePass(owner)
            if (mate) {
              const toMate = norm(sub(mate.pos, b.pos))
              kick = mul(toMate, passPower + rand(-40, 40))
            } else {
              const forward = norm({ x: attackingRight ? 1 : -1, y: 0 })
              const jitter = { x: rand(-0.3, 0.3), y: rand(-0.6, 0.6) }
              const power = owner.isUser ? dribblePower + 60 : dribblePower
              kick = mul(norm(add(forward, jitter)), power + rand(-30, 30))
            }
          }
          const newVel = add(mul(owner.vel, 0.35), kick)
          const speed = len(newVel)
          const clipped = speed > maxKick ? mul(newVel, maxKick / speed) : newVel
          b.vel = clipped
          owner.kickCd = 250 + rand(0, 120)
          ballTouchCd = 110
        }
      }
      // move ball
      b.pos = add(b.pos, mul(b.vel, dt))
      b.vel = mul(b.vel, friction)
      const minY = FIELD.y + 8
      const maxY = FIELD.y + FIELD.hInner - 8
      if (b.pos.y < minY || b.pos.y > maxY) {
        b.pos.y = clamp(b.pos.y, minY, maxY)
        b.vel.y *= -0.7
      }
      const minX = FIELD.x + 8
      const maxX = RIGHT_LINE - 8
      const inGoalY = b.pos.y >= GOAL_MOUTH.y1 && b.pos.y <= GOAL_MOUTH.y2
      if (!inGoalY) {
        if (b.pos.x < minX || b.pos.x > maxX) {
          b.pos.x = clamp(b.pos.x, minX, maxX)
          b.vel.x *= -0.7
        }
      }
      // trail
      const newTrail = [...trailRef.current, { ...b.pos }]
      if (newTrail.length > 24) newTrail.shift()
      // goal?
      let goalFor: Team | null = null
      if (inGoalY) {
        if (b.pos.x <= LEFT_LINE - 4) goalFor = "red"
        if (b.pos.x >= RIGHT_LINE + 4) goalFor = "blue"
      }
      if (goalFor) {
        setScore((s) => ({
          blue: goalFor === "blue" ? s.blue + 1 : s.blue,
          red: goalFor === "red" ? s.red + 1 : s.red,
        }))
        setFlash({ show: true, text: `GOAL! ${goalFor.toUpperCase()}` })
        const after = setTimeout(() => {
          setFlash({ show: false, text: "" })
          const nextKick = goalFor === "blue" ? "red" : "blue"
          resetKickoff(nextKick)
        }, 1500)
        setBall(b); setTrail(newTrail); setPlayers(P)
        cancelAnimationFrame(raf)
        return () => clearTimeout(after)
      }
      setBall(b)
      setTrail(newTrail)
      setPlayers(P)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [hovering, cursorVb])
  // trail path (memo for a11y/paint perf)
  const trailPath = useMemo(() => {
    if (trailRef.current.length < 2) return ""
    const pts = trailRef.current
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  }, [trail])
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toVb(e.clientX, e.clientY)
    if (p) setCursorVb(p)
  }
  return (
    <div className="relative h-full w-full select-none">
      {/* Scoreboard / Help */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border bg-background/70 px-3 py-1 text-xs backdrop-blur">
        <span className="font-semibold text-blue-600 dark:text-blue-400">Blue</span>{" "}
        {score.blue} — {score.red}{" "}
        <span className="font-semibold text-red-600 dark:text-red-400">Red</span>
      </div>
      {/* <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-md border bg-background/70 px-2 py-1 text-[11px] leading-4 backdrop-blur">
        <div><b>You</b>: <span className={userTeam === "blue" ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}>{userTeam.toUpperCase()}</span></div>
        <div>Move: Arrows / WASD</div>
        <div>Shoot: Space • Sprint: Shift</div>
        <div>Toggle Team: T</div>
      </div> */}
      {/* Goal flash */}
      {flash.show && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="animate-in fade-in-50 zoom-in-95 rounded-2xl border bg-background/80 px-6 py-3 text-xl font-extrabold shadow-2xl">
            {flash.text}
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${FIELD.w} ${FIELD.h}`}
        className="h-full w-full rounded-xl"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { setHovering(false); setCursorVb(null) }}
        onMouseMove={onMove}
        role="img"
        aria-label="Interactive soccer field with user-controlled player"
      >
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f7a43" />
            <stop offset="100%" stopColor="#146c3d" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" floodOpacity="0.25" />
          </filter>
        </defs>
        {/* Grass + stripes */}
        <rect x="0" y="0" width={FIELD.w} height={FIELD.h} fill="url(#grass)" />
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x="0" y={i * 100} width={FIELD.w} height="50" fill="#166a3a" opacity="0.25" />
        ))}
        {/* Markings */}
        <g stroke="white" strokeWidth="6" opacity="0.9" filter="url(#softShadow)">
          <rect x={FIELD.x} y={FIELD.y} width={FIELD.wInner} height={FIELD.hInner} fill="none" />
          <line x1={FIELD.w / 2} y1={FIELD.y} x2={FIELD.w / 2} y2={FIELD.y + FIELD.hInner} />
          <circle cx={FIELD.w / 2} cy={FIELD.h / 2} r="90" fill="none" />
          <circle cx={FIELD.w / 2} cy={FIELD.h / 2} r="6" />
          {/* Left penalty */}
          <rect x={FIELD.x} y={FIELD.y + 180} width="220" height="480" fill="none" />
          <rect x={FIELD.x} y={FIELD.y + 280} width="110" height="280" fill="none" />
          {/* Right penalty */}
          <rect x={FIELD.x + FIELD.wInner - 280} y={FIELD.y + 180} width="280" height="480" fill="none" />
          <rect x={FIELD.x + FIELD.wInner - 110} y={FIELD.y + 280} width="110" height="280" fill="none" />
          {/* Goals (visual) */}
          <rect x={FIELD.x - 20} y={GOAL_MOUTH.y1} width="20" height={GOAL_MOUTH.y2 - GOAL_MOUTH.y1} />
          <rect x={FIELD.x + FIELD.wInner} y={GOAL_MOUTH.y1} width="20" height={GOAL_MOUTH.y2 - GOAL_MOUTH.y1} />
        </g>
        {/* Players */}
        <g>
          {players.map((p) => (
            <g key={p.id} transform={`translate(${p.pos.x}, ${p.pos.y})`}>
              {/* User highlight ring */}
              {p.isUser && (
                <>
                  <circle r="22" fill="none" stroke="white" strokeOpacity="0.9" strokeDasharray="2 4" />
                  <text
                    x="0" y="-26"
                    textAnchor="middle"
                    fontSize="16"
                    fill="#fff"
                    stroke="#000"
                    strokeWidth="0.8"
                    style={{ paintOrder: "stroke" }}
                  >
                    YOU
                  </text>
                </>
              )}
              <circle
                r="14"
                fill={p.team === "blue" ? "#2d6cdf" : "#ef4444"}
                filter="url(#softShadow)"
              />
              <circle r="18" fill="none" stroke="white" strokeOpacity="0.25" />
              {p.role === "gk" && <circle r="5" cx="-18" cy="-18" fill="white" opacity="0.9" />}
            </g>
          ))}
        </g>
        {/* Ball trail */}
        {trailPath && (
          <path d={trailPath} stroke="white" strokeOpacity="0.5" strokeWidth="4" fill="none" />
        )}
        {/* Ball */}
        <g transform={`translate(${ball.pos.x}, ${ball.pos.y})`}>
          <circle r="10" fill="white" filter="url(#softShadow)" />
          <circle r="4" cx="-3" cy="-3" fill="white" opacity="0.9" />
        </g>
      </svg>
      {/* Small team toggle pill (clickable) */}
      <div className="absolute left-3 top-3 z-20 rounded-full border bg-background/70 px-2 py-1 text-[11px] backdrop-blur">
        <button
          className="underline"
          title="Toggle your team"
          onClick={() => {
            const next = userTeam === "blue" ? "red" : "blue"
            setUserTeam(next)
            setPlayers(kickoffWithUser(next))
          }}
        >
          Switch Team
        </button>
      </div>
    </div>
  )
}
