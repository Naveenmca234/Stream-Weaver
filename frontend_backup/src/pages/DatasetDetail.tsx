import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FixedSizeList as List } from 'react-window';
import { ArrowLeft, Edit2, Save, X, Database, AlertCircle, FileText } from 'lucide-react';
import { datasetsApi } from '../services/api';
import { formatBytes } from '../utils';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

export function DatasetDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schema' | 'preview'>('schema');
  
  // Schema edit state
  const [isEditingSchema, setIsEditingSchema] = useState(false);
  const [editedSchema, setEditedSchema] = useState<any[]>([]);

  const { data: dataset, isLoading: isDatasetLoading } = useQuery({
    queryKey: ['dataset', id],
    queryFn: async () => {
      const res = await datasetsApi.get(id!);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: previewData, isLoading: isPreviewLoading } = useQuery({
    queryKey: ['dataset_preview', id],
    queryFn: async () => {
      const res = await datasetsApi.getPreview(id!, 100);
      return res.data;
    },
    enabled: !!id && activeTab === 'preview',
  });

  const schemaMutation = useMutation({
    mutationFn: (fields: any[]) => datasetsApi.updateSchema(id!, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset', id] });
      setIsEditingSchema(false);
    },
  });

  const handleEditStart = () => {
    if (dataset?.schema?.fields) {
      setEditedSchema(JSON.parse(JSON.stringify(dataset.schema.fields)));
      setIsEditingSchema(true);
    }
  };

  const handleTypeChange = (index: number, newType: string) => {
    const updated = [...editedSchema];
    updated[index].overriddenType = newType;
    setEditedSchema(updated);
  };

  const handleSaveSchema = () => {
    schemaMutation.mutate(editedSchema);
  };

  if (isDatasetLoading) {
    return <div className="p-8 text-center text-gray-500">Loading dataset...</div>;
  }

  if (!dataset) {
    return <div className="p-8 text-center text-danger-400">Dataset not found</div>;
  }

  const Row = ({ index, style }: any) => {
    const row = previewData?.[index];
    if (!row) return <div style={style} className="flex items-center px-4 border-b border-base-800 text-sm text-gray-500">Loading...</div>;
    
    return (
      <div style={style} className="flex items-center border-b border-base-800 hover:bg-base-800/50">
        {dataset.schema?.fields.map((field: any, i: number) => (
          <div key={i} className="px-4 py-2 text-sm text-gray-300 truncate" style={{ minWidth: 150, flex: 1 }}>
            {String(row[field.name] ?? '')}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/datasets" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{dataset.originalName}</h1>
              <Badge variant={dataset.status === 'ready' ? 'success' : 'warning'}>{dataset.status}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
              <span className="flex items-center gap-1"><FileText size={14}/> {dataset.format.toUpperCase()}</span>
              <span className="flex items-center gap-1"><Database size={14}/> {formatBytes(dataset.size)}</span>
              <span>~{dataset.estimatedRows.toLocaleString()} rows</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-base-800 shrink-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'schema' ? 'border-accent-500 text-accent-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('schema')}
        >
          Schema
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'preview' ? 'border-accent-500 text-accent-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('preview')}
        >
          Data Preview
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {activeTab === 'schema' && (
          <div className="card h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-800 shrink-0">
              <h3 className="text-base font-semibold text-white">Detected Schema</h3>
              {isEditingSchema ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingSchema(false)}>
                    <X size={14} /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveSchema} isLoading={schemaMutation.isPending}>
                    <Save size={14} /> Save Changes
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={handleEditStart}>
                  <Edit2 size={14} /> Edit Types
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-base-900 border-b border-base-800 z-10">
                  <tr>
                    <th className="table-header w-1/4">Field Name</th>
                    <th className="table-header w-1/5">Type</th>
                    <th className="table-header w-1/6">Null %</th>
                    <th className="table-header w-1/6">Unique Vals</th>
                    <th className="table-header">Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditingSchema ? editedSchema : dataset.schema?.fields || []).map((field: any, index: number) => (
                    <tr key={index} className="border-b border-base-800 hover:bg-base-800/30">
                      <td className="px-4 py-3 text-sm font-mono text-gray-200">
                        <div className="flex items-center gap-2">
                          {field.name}
                          {field.isPotentialPii && (
                            <span title="Potential PII detected" className="text-warning-500"><AlertCircle size={14} /></span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isEditingSchema ? (
                          <select
                            className="bg-base-950 border border-base-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent-500"
                            value={field.overriddenType || field.type}
                            onChange={(e) => handleTypeChange(index, e.target.value)}
                          >
                            <option value="string">String</option>
                            <option value="integer">Integer</option>
                            <option value="float">Float</option>
                            <option value="boolean">Boolean</option>
                            <option value="date">Date</option>
                            <option value="object">Object</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="indigo">{field.overriddenType || field.type}</Badge>
                            {field.overriddenType && (
                              <span className="text-xs text-gray-500 line-through">{field.type}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">{field.nullPercentage.toFixed(1)}%</span>
                          {field.nullable && <Badge variant="neutral">Nullable</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {field.uniqueCount > 1000 ? '> 1000' : field.uniqueCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">
                        {field.sampleValues?.slice(0, 3).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="card h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-800 shrink-0">
              <h3 className="text-base font-semibold text-white">Data Preview (First 100 rows)</h3>
            </div>
            
            <div className="flex-1 overflow-auto bg-base-950">
              {isPreviewLoading ? (
                <div className="p-8 text-center text-gray-500">Loading preview...</div>
              ) : previewData?.length > 0 ? (
                <div className="min-w-max h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center border-b border-base-700 bg-base-900 sticky top-0 z-10">
                    {dataset.schema?.fields.map((field: any, i: number) => (
                      <div key={i} className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider" style={{ minWidth: 150, flex: 1 }}>
                        {field.name}
                      </div>
                    ))}
                  </div>
                  {/* Virtualized List */}
                  <div className="flex-1">
                    <List
                      height={600} // This should ideally be auto-calculated using AutoSizer, but fixed for now
                      itemCount={previewData.length}
                      itemSize={40}
                      width="100%"
                      className="no-scrollbar"
                    >
                      {Row}
                    </List>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">No data available for preview.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
