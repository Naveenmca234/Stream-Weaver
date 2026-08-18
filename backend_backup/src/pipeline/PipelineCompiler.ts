import { PipelineGraph, PipelineNode, PipelineEdge } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class PipelineCompiler {
  static validate(graph: PipelineGraph): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { nodes, edges } = graph;

    if (!nodes || nodes.length === 0) {
      errors.push('Pipeline has no nodes');
      return { valid: false, errors, warnings };
    }

    // Check for input node
    const inputNodes = nodes.filter(
      (n) => n.type === 'csv_input' || n.type === 'ndjson_input'
    );
    if (inputNodes.length === 0) {
      errors.push('Pipeline must have at least one input node (CSV or NDJSON)');
    }
    if (inputNodes.length > 1) {
      warnings.push('Multiple input nodes detected; only first will be used');
    }

    // Check for output node
    const outputNodes = nodes.filter(
      (n) => n.type === 'mongodb_output' || n.type === 'file_output'
    );
    if (outputNodes.length === 0) {
      errors.push('Pipeline must have at least one output node');
    }

    // Check all nodes have IDs
    for (const node of nodes) {
      if (!node.id) errors.push('A node is missing its ID');
      if (!node.type) errors.push(`Node ${node.id} is missing its type`);
    }

    // Check for disconnected nodes
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }

    for (const node of nodes) {
      if (!connectedNodeIds.has(node.id)) {
        if (
          node.type !== 'csv_input' &&
          node.type !== 'ndjson_input' &&
          node.type !== 'mongodb_output' &&
          nodes.length > 1
        ) {
          warnings.push(
            `Node "${node.label || node.id}" (${node.type}) appears disconnected`
          );
        }
      }
    }

    // Detect cycles using DFS
    if (PipelineCompiler.hasCycle(nodes, edges)) {
      errors.push('Pipeline graph contains a cycle which is not supported');
    }

    // Validate custom_js nodes have code
    for (const node of nodes) {
      if (node.type === 'custom_js') {
        const data = node.data as Record<string, unknown>;
        if (!data.code || String(data.code).trim() === '') {
          errors.push(`Custom JS node "${node.label || node.id}" has no code defined`);
        }
        if (!data.field) {
          errors.push(
            `Custom JS node "${node.label || node.id}" has no target field defined`
          );
        }
      }
    }

    // Validate MongoDB output has collection
    for (const node of outputNodes) {
      if (node.type === 'mongodb_output') {
        const data = node.data as Record<string, unknown>;
        if (!data.collection) {
          errors.push(`MongoDB output node "${node.label || node.id}" has no collection defined`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  static compile(graph: PipelineGraph): {
    inputNode: PipelineNode;
    outputNode: PipelineNode;
    transformNodes: PipelineNode[];
    targetCollection: string;
  } {
    const validation = PipelineCompiler.validate(graph);
    if (!validation.valid) {
      throw new Error(`Pipeline validation failed: ${validation.errors.join('; ')}`);
    }

    const inputNode = graph.nodes.find(
      (n) => n.type === 'csv_input' || n.type === 'ndjson_input'
    )!;

    const outputNode = graph.nodes.find(
      (n) => n.type === 'mongodb_output' || n.type === 'file_output'
    )!;

    const outputData = outputNode.data as Record<string, unknown>;
    const targetCollection = (outputData.collection as string) || 'processed_records';

    // Topological sort of middle nodes
    const transformNodes = graph.nodes.filter(
      (n) =>
        n.type !== 'csv_input' &&
        n.type !== 'ndjson_input' &&
        n.type !== 'mongodb_output' &&
        n.type !== 'file_output'
    );

    return { inputNode, outputNode, transformNodes, targetCollection };
  }

  private static hasCycle(
    nodes: PipelineNode[],
    edges: PipelineEdge[]
  ): boolean {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) adjacency.set(node.id, []);
    for (const edge of edges) {
      adjacency.get(edge.source)?.push(edge.target);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    function dfs(nodeId: string): boolean {
      if (inStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const neighbor of adjacency.get(nodeId) || []) {
        if (dfs(neighbor)) return true;
      }
      inStack.delete(nodeId);
      return false;
    }

    for (const node of nodes) {
      if (dfs(node.id)) return true;
    }

    return false;
  }
}
