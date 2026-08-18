import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Plus, Server, CheckCircle2, XCircle, Trash2, Key } from 'lucide-react';
import { connectionsApi } from '../services/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';

export function Connections() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newConn, setNewConn] = useState({ name: '', type: 'mongodb', uri: '' });

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await connectionsApi.list();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => connectionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setIsModalOpen(false);
      setNewConn({ name: '', type: 'mongodb', uri: '' });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.test(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: newConn.name,
      type: newConn.type,
      config: { uri: newConn.uri },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connections</h1>
          <p className="text-sm text-gray-400 mt-1">Manage external databases and API credentials</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> New Connection
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center text-gray-500 py-8">Loading connections...</div>
        ) : connections.length === 0 ? (
          <div className="col-span-full card p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-base-800 rounded-full flex items-center justify-center mb-4">
              <Key size={32} className="text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No connections found</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">Connect to MongoDB, PostgreSQL, or other APIs to load your processed data.</p>
            <Button onClick={() => setIsModalOpen(true)}>Create Connection</Button>
          </div>
        ) : (
          connections.map((conn: any) => (
            <div key={conn._id} className="card p-5 flex flex-col hover:border-base-600 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-base-800 border border-base-700 flex items-center justify-center">
                    <Server size={20} className="text-accent-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{conn.name}</h3>
                    <Badge variant="indigo" className="mt-1 capitalize">{conn.type}</Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 text-sm space-y-2 text-gray-400 mb-6 font-mono">
                {conn.config?.uri && <div className="truncate text-xs">URI: {conn.config.uri.replace(/:[^:@]*@/, ':****@')}</div>}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-base-800">
                <div className="flex items-center gap-1.5 text-sm">
                  {conn.status === 'connected' ? (
                    <><CheckCircle2 size={16} className="text-success-500"/> <span className="text-success-500">Connected</span></>
                  ) : conn.status === 'failed' ? (
                    <><XCircle size={16} className="text-danger-500"/> <span className="text-danger-500">Failed</span></>
                  ) : (
                    <span className="text-gray-500">Untested</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => testMutation.mutate(conn._id)}
                    isLoading={testMutation.isPending}
                  >
                    Test
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if(confirm('Delete connection?')) deleteMutation.mutate(conn._id);
                    }}
                  >
                    <Trash2 size={16} className="text-danger-400" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-base-900 border border-base-700 rounded-lg shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">New Connection</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input 
                label="Connection Name" 
                placeholder="e.g. Production MongoDB" 
                required 
                value={newConn.name}
                onChange={e => setNewConn({...newConn, name: e.target.value})}
              />
              
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Type</label>
                <select 
                  className="w-full bg-base-800 border border-base-600 rounded-md px-3 py-2 text-sm text-gray-100"
                  value={newConn.type}
                  onChange={e => setNewConn({...newConn, type: e.target.value})}
                >
                  <option value="mongodb">MongoDB</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="rest_api">REST API</option>
                </select>
              </div>

              <Input 
                label="Connection URI / String" 
                placeholder="mongodb://user:pass@host:port/db" 
                required 
                value={newConn.uri}
                onChange={e => setNewConn({...newConn, uri: e.target.value})}
              />

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} type="button">Cancel</Button>
                <Button type="submit" isLoading={createMutation.isPending}>Save Connection</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
