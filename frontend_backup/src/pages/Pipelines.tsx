import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Network, Plus, Search, Trash2, Edit2, Play, GitBranch } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { pipelinesApi, runsApi } from '../services/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';

export function Pipelines() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const res = await pipelinesApi.list();
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pipelinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (data: { pipelineId: string; pipelineVersionId: string; datasetId: string }) => 
      runsApi.create(data),
    onSuccess: (res) => {
      navigate(`/runs/${res.data.runId}`);
    },
  });

  const pipelines = data?.pipelines || [];
  const filteredPipelines = pipelines.filter((p: any) => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pipelines</h1>
          <p className="text-sm text-gray-400 mt-1">Design and manage ETL workflows</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/pipelines/new')}>
            <Plus size={16} /> Create Pipeline
          </Button>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-base-800 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder="Search pipelines..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-400">
            {filteredPipelines.length} pipelines
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading pipelines...</div>
        ) : filteredPipelines.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-base-800 flex items-center justify-center mb-4 text-gray-500">
              <Network size={32} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No pipelines found</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-sm">
              Create your first ETL pipeline to start processing data.
            </p>
            <Button onClick={() => navigate('/pipelines/new')}>
              <Plus size={16} /> Create Pipeline
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Version</th>
                  <th className="table-header">Last Modified</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPipelines.map((pipeline: any) => (
                  <tr key={pipeline._id} className="hover:bg-base-800/50 transition-colors group">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <Network className="text-accent-500 w-5 h-5" />
                        <div>
                          <Link to={`/pipelines/${pipeline._id}/edit`} className="font-medium text-white hover:text-accent-400 hover:underline">
                            {pipeline.name}
                          </Link>
                          {pipeline.description && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                              {pipeline.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge variant={pipeline.status === 'published' ? 'success' : 'neutral'}>
                        {pipeline.status}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 text-gray-300">
                        <GitBranch size={14} className="text-gray-500" />
                        v{pipeline.currentVersion}
                      </div>
                    </td>
                    <td className="table-cell text-xs text-gray-400">
                      {new Date(pipeline.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          title="Execute Run"
                          onClick={() => {
                            const datasetId = prompt('Enter dataset ID for execution (mock flow):');
                            if (datasetId) {
                              executeMutation.mutate({
                                pipelineId: pipeline._id,
                                pipelineVersionId: pipeline._id,
                                datasetId
                              });
                            }
                          }}
                        >
                          <Play size={16} className="text-success-400" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/pipelines/${pipeline._id}/edit`)}
                        >
                          <Edit2 size={16} className="text-gray-400" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this pipeline?')) {
                              deleteMutation.mutate(pipeline._id);
                            }
                          }}
                        >
                          <Trash2 size={16} className="text-danger-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
