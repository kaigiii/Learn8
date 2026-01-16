
"use client";

import React, { useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Node,
    Edge,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CoursePath } from '@/types/lesson';
import { clsx } from 'clsx';

interface SyllabusMapProps {
    coursePath: CoursePath;
    onNodeClick: (nodeId: string) => void;
}

const nodeWidth = 200;

export const SyllabusMap: React.FC<SyllabusMapProps> = ({ coursePath, onNodeClick }) => {
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        const generatedNodes: Node[] = [];
        const generatedEdges: Edge[] = [];

        if (!coursePath?.units) return { nodes: [], edges: [] };

        const COLUMN_WIDTH = 300;
        const ROW_HEIGHT = 120;
        const HEADER_HEIGHT = 60;
        const BASE_Y = 50;

        let previousGlobalNodeId: string | null = null;

        coursePath.units.forEach((unit, unitIndex) => {
            const xPos = unitIndex * COLUMN_WIDTH + 50; // Padding

            // 1. Add Unit Header Node
            // We use a group-like style or just a distinct node at the top
            generatedNodes.push({
                id: `unit-${unit.unitId}`,
                data: { label: unit.unitTitle },
                position: { x: xPos, y: 0 },
                style: {
                    width: nodeWidth,
                    height: 40,
                    background: 'transparent',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    color: '#64748b',
                    textAlign: 'center',
                },
                selectable: false,
                draggable: false,
                type: 'default'
            });

            // 2. Add Unit Description Node (Optional, below title?)
            // Skipping for now to keep it clean, or could add as smaller text

            // 3. Stack Lesson Nodes
            unit.nodes.forEach((lessonNode, nodeIndex) => {
                const nodeId = lessonNode.id;
                const yPos = BASE_Y + HEADER_HEIGHT + (nodeIndex * ROW_HEIGHT);
                const isLocked = lessonNode.status === 'locked';
                const isCompleted = lessonNode.status === 'completed';

                generatedNodes.push({
                    id: nodeId,
                    data: { label: lessonNode.title, type: lessonNode.type, status: lessonNode.status },
                    position: { x: xPos, y: yPos },
                    sourcePosition: 'right' as any,
                    targetPosition: 'left' as any,
                    style: {
                        border: isCompleted ? '2px solid #22c55e' : isLocked ? '1px solid #cbd5e1' : '2px solid #3b82f6',
                        padding: 10,
                        borderRadius: 8,
                        background: isCompleted ? '#f0fdf4' : isLocked ? '#f1f5f9' : '#fff',
                        opacity: isLocked ? 0.7 : 1,
                        width: nodeWidth,
                        boxShadow: isLocked ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    },
                });

                // Connect to previous node (Sequence)
                if (previousGlobalNodeId) {
                    generatedEdges.push({
                        id: `e-${previousGlobalNodeId}-${nodeId}`,
                        source: previousGlobalNodeId,
                        target: nodeId,
                        type: 'smoothstep', // Better for grid links
                        markerEnd: { type: MarkerType.ArrowClosed },
                        animated: lessonNode.status === 'available',
                        style: { stroke: '#94a3b8', strokeWidth: 2 }
                    });
                }
                previousGlobalNodeId = nodeId;
            });
        });

        return { nodes: generatedNodes, edges: generatedEdges };
    }, [coursePath]);

    return (
        <div style={{ width: '100%', height: '100%', background: '#fafafa' }}>
            <ReactFlow
                nodes={initialNodes}
                edges={initialEdges}
                onNodeClick={(_, node) => {
                    // Ignore unit header clicks
                    if (!node.id.startsWith('unit-')) {
                        onNodeClick(node.id);
                    }
                }}
                fitView
            >
                <Background color="#f1f5f9" gap={20} />
                <Controls />
            </ReactFlow>
        </div>
    );
};
