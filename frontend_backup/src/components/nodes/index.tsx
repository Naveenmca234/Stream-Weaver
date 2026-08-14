import React from 'react';
import { Handle, Position } from 'reactflow';
import { Database, Filter, Settings, FileText } from 'lucide-react';
import { cn } from '../../utils';

interface NodeProps {
  data: {
    label: string;
    config?: any;
    selected?: boolean;
  };
}

export function SourceNode({ data }: NodeProps) {
  return (
    <div className={cn(
      "w-64 bg-base-900 border rounded-lg shadow-lg relative",
      data.selected ? "border-accent-500 shadow-accent-500/20" : "border-base-700"
    )}>
      <div className="bg-indigo-500/10 border-b border-indigo-500/20 p-3 rounded-t-lg flex items-center gap-2">
        <FileText className="text-indigo-400" size={16} />
        <span className="font-semibold text-white text-sm">Source</span>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-300 font-medium">{data.label}</div>
        <div className="text-xs text-gray-500 mt-1">Extract dataset stream</div>
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-accent-500 border-2 border-base-900"
      />
    </div>
  );
}

export function TransformNode({ data }: NodeProps) {
  return (
    <div className={cn(
      "w-64 bg-base-900 border rounded-lg shadow-lg relative",
      data.selected ? "border-accent-500 shadow-accent-500/20" : "border-base-700"
    )}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-accent-500 border-2 border-base-900"
      />
      <div className="bg-warning-500/10 border-b border-warning-500/20 p-3 rounded-t-lg flex items-center gap-2">
        <Filter className="text-warning-400" size={16} />
        <span className="font-semibold text-white text-sm">Transform</span>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-300 font-medium">{data.label}</div>
        <div className="text-xs text-gray-500 mt-1">Apply rules & validation</div>
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-accent-500 border-2 border-base-900"
      />
    </div>
  );
}

export function DestinationNode({ data }: NodeProps) {
  return (
    <div className={cn(
      "w-64 bg-base-900 border rounded-lg shadow-lg relative",
      data.selected ? "border-accent-500 shadow-accent-500/20" : "border-base-700"
    )}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-accent-500 border-2 border-base-900"
      />
      <div className="bg-success-500/10 border-b border-success-500/20 p-3 rounded-t-lg flex items-center gap-2">
        <Database className="text-success-400" size={16} />
        <span className="font-semibold text-white text-sm">Destination</span>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-300 font-medium">{data.label}</div>
        <div className="text-xs text-gray-500 mt-1">Load into target system</div>
      </div>
    </div>
  );
}
