'use client'

import React, { useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
  Position,                 // ⬅️ add this
} from '@xyflow/react'

import '@xyflow/react/dist/style.css'
import dagre from 'dagre'


export type GraphApi = {
  fit: () => void
  zoomIn: () => void
  zoomOut: () => void
  centerOn: (id: string) => void
}

type Player = {
  id: string
  full_name: string
  main_position?: string | null
  current_club_name?: string | null
  current_club_country?: string | null
  image_url?: string | null
}

function layoutLR(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 30, edgesep: 10, ranksep: 60 })

  const width = 200
  const height = 60

  nodes.forEach((n) => g.setNode(n.id, { width, height }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map((n) => {
    const p = g.node(n.id)
    n.position = { x: p.x - width / 2, y: p.y - height / 2 }
    n.targetPosition = Position.Left     // ⬅️ was 'left'
    n.sourcePosition = Position.Right    // ⬅️ was 'right'
    return n
  })
}


export default function PlayersGraphFlow({
  players,
  selectedId,
  onSelect,
  setApi,
}: {
  players: Player[]
  selectedId: string | null
  onSelect: (row: Player | null) => void
  setApi?: (api: GraphApi | null) => void
}) {
  // Build graph data
  const { nodesInitial, edgesInitial } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    nodes.push({
      id: 'root',
      data: { label: 'My Players', kind: 'group' },
      position: { x: 0, y: 0 },
      type: 'default',
      style: { fontWeight: 600, background: 'var(--background)', border: '1px solid var(--border)' },
    })

    const positions = Array.from(new Set(players.map((p) => p.main_position || 'Unknown')))
    positions.forEach((pos) => {
      const id = `pos:${pos}`
      nodes.push({
        id,
        data: { label: pos, kind: 'group' },
        position: { x: 0, y: 0 },
        type: 'default',
        style: { background: 'var(--card)', border: '1px solid var(--border)' },
      })
      edges.push({ id: `e-root-${id}`, source: 'root', target: id })
    })

    players.forEach((p) => {
      const pid = `pos:${p.main_position || 'Unknown'}`
      nodes.push({
        id: p.id,
        data: { label: p.full_name, player: p },
        position: { x: 0, y: 0 },
        type: 'default',
        style: { background: 'var(--muted)', border: '1px solid var(--border)' },
      })
      edges.push({ id: `e-${pid}-${p.id}`, source: pid, target: p.id })
    })

    return { nodesInitial: nodes, edgesInitial: edges }
  }, [players])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const rfRef = useRef<ReactFlowInstance | null>(null)

  // Init nodes/edges + layout (no loops)
  useEffect(() => {
    const laid = layoutLR([...nodesInitial], [...edgesInitial])
    setNodes(laid)
    setEdges(edgesInitial)
  }, [nodesInitial, edgesInitial, setNodes, setEdges])

const onInit = useCallback((inst: ReactFlowInstance) => {
  rfRef.current = inst

  // Fit once on mount
  requestAnimationFrame(() => inst.fitView({ padding: 0.2 }))

  setApi?.({
    fit: () => inst.fitView({ padding: 0.2 }),

    zoomIn: () => {
      const anyInst = inst as any
      if (typeof anyInst.zoomIn === 'function') anyInst.zoomIn()
      else if (typeof anyInst.setZoom === 'function') anyInst.setZoom(inst.getZoom() * 1.15)
      else inst.fitView({ padding: 0.15 })
    },

    zoomOut: () => {
      const anyInst = inst as any
      if (typeof anyInst.zoomOut === 'function') anyInst.zoomOut()
      else if (typeof anyInst.setZoom === 'function') anyInst.setZoom(inst.getZoom() / 1.15)
      else inst.fitView({ padding: 0.25 })
    },

    centerOn: (id: string) => {
      const n = inst.getNodes().find((x) => x.id === id)
      if (!n) return
      // Center/zoom using fitView with a single target node (typed-safe)
      inst.fitView({ nodes: [n], padding: 0.2 })
    },
  })
}, [setApi])



  // Clean API on unmount
  useEffect(() => () => setApi?.(null), [setApi])

// replace your existing onNodeClick with this:
const onNodeClick = useCallback(
  (_: any, node: Node) => {
    const p = (node.data as any)?.player as Player | undefined
    onSelect(p ?? null)

    // center/zoom on the clicked node without using positionAbsolute
    if (p && rfRef.current) {
      rfRef.current.fitView({ nodes: [node], padding: 0.2 })
    }
  },
  [onSelect]
)


  // Highlight selected node (cheap)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: {
          ...n.style,
          boxShadow: selectedId && n.id === selectedId ? '0 0 0 2px #10b981' : undefined,
          border: '1px solid var(--border)',
        },
      }))
    )
  }, [selectedId, setNodes])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onInit={onInit}
        fitView={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <MiniMap pannable zoomable />
        <Controls position="top-left" />
      </ReactFlow>
    </div>
  )
}
