import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Database, Plus, Search, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { datasetsApi } from '../services/api';
import { formatBytes } from '../utils';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';

export function Datasets() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const res = await datasetsApi.list(1, 100); // Simple demo pagination
      return res.data;
    },
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);
      
      return datasetsApi.upload(formData, (pct) => {
        setUploadProgress(pct);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onSettled: () => {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => datasetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const datasets = data?.datasets || [];
  const filteredDatasets = datasets.filter((d: any) => 
    d.originalName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Datasets</h1>
          <p className="text-sm text-gray-400 mt-1">Manage source datasets for ETL processing</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary"
            onClick={() => {
              // Generate demo data
              const link = document.createElement('a');
              link.href = '/api/demo/generate?type=customers&count=100000';
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Generate Demo Data
          </Button>
          
          <Button onClick={() => fileInputRef.current?.click()} isLoading={isUploading}>
            <Upload size={16} />
            {isUploading ? `Uploading ${uploadProgress}%` : 'Upload Dataset'}
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv,.json,.ndjson" 
            onChange={handleFileSelect}
          />
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-base-800 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder="Search datasets..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="text-sm text-gray-400">
            {filteredDatasets.length} datasets
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading datasets...</div>
        ) : filteredDatasets.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-base-800 flex items-center justify-center mb-4 text-gray-500">
              <Database size={32} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No datasets found</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-sm">
              Upload your first CSV or NDJSON file to start building ETL pipelines.
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Plus size={16} /> Upload Dataset
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Format</th>
                  <th className="table-header">Size</th>
                  <th className="table-header">Rows</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Uploaded</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasets.map((dataset: any) => (
                  <tr key={dataset._id} className="hover:bg-base-800/50 transition-colors group">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <FileText className="text-accent-500 w-5 h-5" />
                        <div>
                          <Link to={`/datasets/${dataset._id}`} className="font-medium text-white hover:text-accent-400 hover:underline">
                            {dataset.originalName}
                          </Link>
                          {dataset.schema && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {dataset.schema.totalFields} columns detected
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge variant="neutral" className="uppercase tracking-wide">{dataset.format}</Badge>
                    </td>
                    <td className="table-cell font-mono text-xs">{formatBytes(dataset.size)}</td>
                    <td className="table-cell font-mono text-xs">
                      {dataset.estimatedRows > 0 ? `~${dataset.estimatedRows.toLocaleString()}` : 'Calculating...'}
                    </td>
                    <td className="table-cell">
                      <Badge variant={
                        dataset.status === 'ready' ? 'success' :
                        dataset.status === 'error' ? 'danger' :
                        dataset.status === 'uploading' ? 'accent' : 'warning'
                      }>
                        {dataset.status === 'processing' && <span className="w-2 h-2 rounded-full bg-warning-400 animate-ping mr-1 inline-block" />}
                        {dataset.status}
                      </Badge>
                    </td>
                    <td className="table-cell text-xs text-gray-400">
                      {new Date(dataset.createdAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this dataset?')) {
                              deleteMutation.mutate(dataset._id);
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
