import React, { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Panel,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Save, Settings, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { pipelinesApi } from '../services/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SourceNode, TransformNode, DestinationNode } from '../components/nodes';
import { Input } from '../components/Input';

const nodeTypes = {
  transform: TransformNode,
  source: SourceNode,
  destination: DestinationNode,
};

export function PipelineBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [name, setName] = useState('New Pipeline');
  const [description, setDescription] = useState('');

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: async () => {
      if (isNew) return null;
      const res = await pipelinesApi.get(id!);
      return res.data;
    },
    enabled: !isNew,
  });

  // Load existing pipeline
  React.useEffect(() => {
    if (pipeline?.graph) {
      setName(pipeline.name);
      setDescription(pipeline.description || '');
      setNodes(pipeline.graph.nodes || []);
      setEdges(pipeline.graph.edges || []);
    }
  }, [pipeline, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' }, style: { stroke: '#363b54', strokeWidth: 2 } }, eds)),
    [setEdges],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        graph: { nodes, edges },
      };
      if (isNew) {
        return pipelinesApi.create(payload);
      }
      return pipelinesApi.update(id!, payload);
    },
    onSuccess: (res) => {
      if (isNew) {
        navigate(`/pipelines/${res.data._id}/edit`, { replace: true });
      }
    },
  });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 50,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      const newNode = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: { label: `${type} node`, config: {} },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  if (!isNew && isLoading) return <div className="p-8 text-center text-gray-500">Loading pipeline...</div>;

  return (
    <div className="h-full flex flex-col -m-6 animate-fade-in bg-base-950">
      {/* Toolbar */}
      <div className="h-16 border-b border-base-800 bg-base-900/80 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="w-64 bg-transparent border-transparent hover:border-base-700 focus:border-accent-500 font-bold text-lg px-2"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/pipelines')}>Cancel</Button>
          <Button 
            variant="secondary" 
            onClick={() => saveMutation.mutate()} 
            isLoading={saveMutation.isPending}
          >
            <Save size={16} /> Save Draft
          </Button>
          {!isNew && (
            <Button className="bg-success-600 hover:bg-success-500">
              <Play size={16} /> Execute Run
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Node Library Sidebar */}
        <div className="w-64 border-r border-base-800 bg-base-900 flex flex-col">
          <div className="p-4 border-b border-base-800">
            <h3 className="font-semibold text-white">Node Library</h3>
            <p className="text-xs text-gray-400 mt-1">Drag and drop to build</p>
          </div>
          
          <div className="p-4 space-y-4 overflow-y-auto">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sources</div>
              <div 
                className="p-3 border border-base-700 bg-base-800 rounded cursor-grab hover:border-accent-500 transition-colors"
                onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'source')}
                draggable
              >
                <div className="text-sm font-medium text-white">Dataset Input</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Transformations</div>
              <div 
                className="p-3 border border-base-700 bg-base-800 rounded cursor-grab hover:border-accent-500 transition-colors mb-2"
                onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'transform')}
                draggable
              >
                <div className="text-sm font-medium text-white">Filter / Clean</div>
              </div>
              <div 
                className="p-3 border border-base-700 bg-base-800 rounded cursor-grab hover:border-accent-500 transition-colors"
                onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'transform')}
                draggable
              >
                <div className="text-sm font-medium text-white">Custom JS (Sandbox)</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Destinations</div>
              <div 
                className="p-3 border border-base-700 bg-base-800 rounded cursor-grab hover:border-accent-500 transition-colors"
                onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'destination')}
                draggable
              >
                <div className="text-sm font-medium text-white">MongoDB Bulk Load</div>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-base-950"
          >
            <Background color="#2d3148" gap={16} />
            <Controls className="bg-base-900 border-base-700 fill-white" />
            <MiniMap 
              nodeColor="#363b54" 
              maskColor="rgba(10, 11, 13, 0.7)"
              className="bg-base-900 border border-base-700"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
