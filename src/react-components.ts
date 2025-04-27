// src/components/GraphEditor.tsx

import React, { useState, useEffect, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { Category, Connection, AttributeCreateDTO } from '../types';
import { CategoryForm } from './CategoryForm';
import { ConnectionForm } from './ConnectionForm';
import { AttributeForm } from './AttributeForm';
import { Button, Card, Tabs, Tab, Dialog, DialogContent, DialogTitle } from '@mui/material';

// Регистрация расширения dagre для автоматического размещения графа
cytoscape.use(dagre);

interface GraphEditorProps {
  conceptId: string;
  readOnly?: boolean;
  onGraphChange?: () => void;
}

export const GraphEditor: React.FC<GraphEditorProps> = ({ conceptId, readOnly = false, onGraphChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [cyInstance, setCyInstance] = useState<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<Category | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Connection | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showAttributeForm, setShowAttributeForm] = useState(false);
  const [isAttributeForCategory, setIsAttributeForCategory] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка данных графа
  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/concepts/${conceptId}/graph`);
      if (!response.ok) {
        throw new Error('Failed to load concept graph');
      }
      const data = await response.json();
      setCategories(data.categories);
      setConnections(data.connections);
      setError(null);
    } catch (err) {
      setError(`Error loading graph: ${err.message}`);
      console.error('Error loading graph:', err);
    } finally {
      setLoading(false);
    }
  }, [conceptId]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData, conceptId]);

  // Конвертация данных для Cytoscape
  const cytoscapeElements = React.useMemo(() => {
    const nodes = categories.map(category => ({
      data: {
        id: category.category_id,
        label: category.name,
        definition: category.definition,
        attributes: category.attributes || [],
        type: 'category'
      }
    }));

    const edges = connections.map(connection => ({
      data: {
        id: connection.connection_id,
        source: connection.source_category_id,
        target: connection.target_category_id,
        label: connection.connection_type,
        direction: connection.direction,
        description: connection.description,
        attributes: connection.attributes || [],
        type: 'connection'
      }
    }));

    return [...nodes, ...edges];
  }, [categories, connections]);

  // Стили для Cytoscape
  const cytoscapeStylesheet = [
    {
      selector: 'node',
      style: {
        'background-color': '#4285F4',
        'label': 'data(label)',
        'width': 100,
        'height': 100,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '80px',
        'font-size': '12px',
        'color': 'white'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 3,
        'line-color': '#888',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'text-rotation': 'autorotate',
        'text-margin-y': '-10px',
        'font-size': '10px'
      }
    },
    {
      selector: 'edge[direction = "directed"]',
      style: {
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#888'
      }
    },
    {
      selector: 'edge[direction = "bidirectional"]',
      style: {
        'target-arrow-shape': 'triangle',
        'source-arrow-shape': 'triangle',
        'target-arrow-color': '#888',
        'source-arrow-color': '#888'
      }
    },
    {
      selector: ':selected',
      style: {
        'background-color': '#FF5722',
        'line-color': '#FF5722',
        'target-arrow-color': '#FF5722',
        'source-arrow-color': '#FF5722'
      }
    }
  ];

  // Обработчики событий для выбора элементов
  const handleNodeSelect = useCallback((event: cytoscape.EventObject) => {
    const nodeId = event.target.id();
    const category = categories.find(c => c.category_id === nodeId);
    if (category) {
      setSelectedNode(category);
      setSelectedEdge(null);
    }
  }, [categories]);

  const handleEdgeSelect = useCallback((event: cytoscape.EventObject) => {
    const edgeId = event.target.id();
    const connection = connections.find(c => c.connection_id === edgeId);
    if (connection) {
      setSelectedEdge(connection);
      setSelectedNode(null);
    }
  }, [connections]);

  const handleCytoscapeReady = useCallback((cy: cytoscape.Core) => {
    setCyInstance(cy);
    
    cy.on('tap', 'node', handleNodeSelect);
    cy.on('tap', 'edge', handleEdgeSelect);
    cy.on('tap', function(event) {
      if (event.target === cy) {
        setSelectedNode(null);
        setSelectedEdge(null);
      }
    });
    
    // Автоматическое размещение элементов
    const layout = cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      padding: 50,
      fit: true
    });
    layout.run();
  }, [handleNodeSelect, handleEdgeSelect]);

  // Обработчики для форм
  const handleAddCategory = async (newCategory: Omit<Category, 'category_id' | 'created_at' | 'last_modified'>) => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCategory)
      });
      
      if (!response.ok) {
        throw new Error('Failed to add category');
      }
      
      await loadGraphData();
      if (onGraphChange) onGraphChange();
      setShowCategoryForm(false);
    } catch (err) {
      setError(`Error adding category: ${err.message}`);
      console.error('Error adding category:', err);
    }
  };

  const handleAddConnection = async (newConnection: Omit<Connection, 'connection_id' | 'created_at' | 'last_modified' | 'source_category' | 'target_category'>) => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}/connections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConnection)
      });
      
      if (!response.ok) {
        throw new Error('Failed to add connection');
      }
      
      await loadGraphData();
      if (onGraphChange) onGraphChange();
      setShowConnectionForm(false);
    } catch (err) {
      setError(`Error adding connection: ${err.message}`);
      console.error('Error adding connection:', err);
    }
  };

  const handleAddAttribute = async (attributeData: AttributeCreateDTO) => {
    try {
      const targetId = isAttributeForCategory 
        ? selectedNode?.category_id 
        : selectedEdge?.connection_id;
      
      if (!targetId) {
        throw new Error('No target selected for attribute');
      }
      
      const endpoint = isAttributeForCategory 
        ? `/api/categories/${targetId}/attributes` 
        : `/api/connections/${targetId}/attributes`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(attributeData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add ${isAttributeForCategory ? 'category' : 'connection'} attribute`);
      }
      
      await loadGraphData();
      if (onGraphChange) onGraphChange();
      setShowAttributeForm(false);
    } catch (err) {
      setError(`Error adding attribute: ${err.message}`);
      console.error('Error adding attribute:', err);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedNode) return;
    
    if (!window.confirm(`Are you sure you want to delete "${selectedNode.name}" category?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/categories/${selectedNode.category_id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete category');
      }
      
      setSelectedNode(null);
      await loadGraphData();
      if (onGraphChange) onGraphChange();
    } catch (err) {
      setError(`Error deleting category: ${err.message}`);
      console.error('Error deleting category:', err);
    }
  };

  const handleDeleteConnection = async () => {
    if (!selectedEdge) return;
    
    if (!window.confirm(`Are you sure you want to delete this connection?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/connections/${selectedEdge.connection_id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete connection');
      }
      
      setSelectedEdge(null);
      await loadGraphData();
      if (onGraphChange) onGraphChange();
    } catch (err) {
      setError(`Error deleting connection: ${err.message}`);
      console.error('Error deleting connection:', err);
    }
  };

  const handleEnrichCategory = async () => {
    if (!selectedNode) return;
    
    try {
      const response = await fetch(`/api/categories/${selectedNode.category_id}/enrich`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to enrich category');
      }
      
      await loadGraphData();
      if (onGraphChange) onGraphChange();
    } catch (err) {
      setError(`Error enriching category: ${err.message}`);
      console.error('Error enriching category:', err);
    }
  };

  const handleEnrichConnection = async () => {
    if (!selectedEdge) return;
    
    try {
      const response = await fetch(`/api/connections/${selectedEdge.connection_id}/enrich`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to enrich connection');
      }
      
      await loadGraphData();
      if (onGraphChange) onGraphChange();
    } catch (err) {
      setError(`Error enriching connection: ${err.message}`);
      console.error('Error enriching connection:', err);
    }
  };

  const handleValidateGraph = async () => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}/validate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to validate graph');
      }
      
      const validationResult = await response.json();
      // Здесь можно добавить модальное окно с результатами валидации
      console.log('Validation result:', validationResult);
    } catch (err) {
      setError(`Error validating graph: ${err.message}`);
      console.error('Error validating graph:', err);
    }
  };

  if (loading) {
    return <div>Loading graph...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="graph-editor">
      <div className="graph-controls" style={{ marginBottom: '10px' }}>
        {!readOnly && (
          <>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => setShowCategoryForm(true)} 
              style={{ marginRight: '10px' }}
            >
              Add Category
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => setShowConnectionForm(true)} 
              style={{ marginRight: '10px' }}
              disabled={categories.length < 2}
            >
              Add Connection
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleValidateGraph}
            >
              Validate Graph
            </Button>
          </>
        )}
      </div>
      
      <div style={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
        <div style={{ flex: 3, border: '1px solid #ddd', borderRadius: '5px', overflow: 'hidden' }}>
          <CytoscapeComponent
            elements={cytoscapeElements}
            stylesheet={cytoscapeStylesheet}
            layout={{ name: 'dagre' }}
            cy={handleCytoscapeReady}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        
        <div style={{ flex: 1, marginLeft: '20px', overflowY: 'auto' }}>
          {selectedNode && (
            <Card style={{ padding: '15px', marginBottom: '15px' }}>
              <h3>{selectedNode.name}</h3>
              <p><strong>Definition:</strong> {selectedNode.definition}</p>
              {selectedNode.extended_description && (
                <p><strong>Extended Description:</strong> {selectedNode.extended_description}</p>
              )}
              {selectedNode.source && (
                <p><strong>Source:</strong> {selectedNode.source}</p>
              )}
              
              {selectedNode.attributes && selectedNode.attributes.length > 0 && (
                <div>
                  <h4>Attributes:</h4>
                  <ul>
                    {selectedNode.attributes.map(attr => (
                      <li key={attr.attribute_id}>
                        <strong>{attr.attribute_type}:</strong> {attr.value}
                        {attr.justification && <div><small>Justification: {attr.justification}</small></div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
			  
			  {selectedNode.tradition_concepts && selectedNode.tradition_concepts.length > 0 && (
				  <div>
					<strong>Traditions/Concepts:</strong>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
					  {selectedNode.tradition_concepts.map((tradition, index) => (
						<Chip key={index} label={tradition} size="small" />
					  ))}
					</div>
				  </div>
				)}
				{selectedNode.philosophers && selectedNode.philosophers.length > 0 && (
				  <div style={{ marginTop: '10px' }}>
					<strong>Philosophers:</strong>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
					  {selectedNode.philosophers.map((philosopher, index) => (
						<Chip key={index} label={philosopher} size="small" />
					  ))}
					</div>
				  </div>
				)}
              
              {!readOnly && (
                <div style={{ marginTop: '10px' }}>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small" 
                    onClick={() => {
                      setIsAttributeForCategory(true);
                      setShowAttributeForm(true);
                    }} 
                    style={{ marginRight: '10px' }}
                  >
                    Add Attribute
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small" 
                    onClick={handleEnrichCategory} 
                    style={{ marginRight: '10px' }}
                  >
                    Enrich
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    size="small" 
                    onClick={handleDeleteCategory}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          )}
          
          {selectedEdge && (
            <Card style={{ padding: '15px', marginBottom: '15px' }}>
              <h3>Connection: {selectedEdge.connection_type}</h3>
              <p><strong>From:</strong> {selectedEdge.source_category?.name}</p>
              <p><strong>To:</strong> {selectedEdge.target_category?.name}</p>
              <p><strong>Direction:</strong> {selectedEdge.direction}</p>
              {selectedEdge.description && (
                <p><strong>Description:</strong> {selectedEdge.description}</p>
              )}
              
              {selectedEdge.attributes && selectedEdge.attributes.length > 0 && (
                <div>
                  <h4>Attributes:</h4>
                  <ul>
                    {selectedEdge.attributes.map(attr => (
                      <li key={attr.attribute_id}>
                        <strong>{attr.attribute_type}:</strong> {attr.value}
                        {attr.justification && <div><small>Justification: {attr.justification}</small></div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
			  
			  {selectedEdge.tradition_concepts && selectedEdge.tradition_concepts.length > 0 && (
				  <div>
					<strong>Traditions/Concepts:</strong>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
					  {selectedEdge.tradition_concepts.map((tradition, index) => (
						<Chip key={index} label={tradition} size="small" />
					  ))}
					</div>
				  </div>
				)}
				{selectedEdge.philosophers && selectedEdge.philosophers.length > 0 && (
				  <div style={{ marginTop: '10px' }}>
					<strong>Philosophers:</strong>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
					  {selectedEdge.philosophers.map((philosopher, index) => (
						<Chip key={index} label={philosopher} size="small" />
					  ))}
					</div>
				  </div>
				)}
              
              {!readOnly && (
                <div style={{ marginTop: '10px' }}>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small" 
                    onClick={() => {
                      setIsAttributeForCategory(false);
                      setShowAttributeForm(true);
                    }} 
                    style={{ marginRight: '10px' }}
                  >
                    Add Attribute
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small" 
                    onClick={handleEnrichConnection} 
                    style={{ marginRight: '10px' }}
                  >
                    Enrich
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    size="small" 
                    onClick={handleDeleteConnection}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          )}
          
          {!selectedNode && !selectedEdge && (
            <Card style={{ padding: '15px' }}>
              <p>Select a category or connection to view details</p>
            </Card>
          )}
        </div>
      </div>
      
      {/* Модальные окна для форм */}
      <Dialog open={showCategoryForm} onClose={() => setShowCategoryForm(false)}>
        <DialogTitle>Add Category</DialogTitle>
        <DialogContent>
          <CategoryForm 
            conceptId={conceptId} 
            onSubmit={handleAddCategory} 
            onCancel={() => setShowCategoryForm(false)} 
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={showConnectionForm} onClose={() => setShowConnectionForm(false)}>
        <DialogTitle>Add Connection</DialogTitle>
        <DialogContent>
          <ConnectionForm 
            conceptId={conceptId} 
            categories={categories}
            onSubmit={handleAddConnection} 
            onCancel={() => setShowConnectionForm(false)} 
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={showAttributeForm} onClose={() => setShowAttributeForm(false)}>
        <DialogTitle>
          Add {isAttributeForCategory ? 'Category' : 'Connection'} Attribute
        </DialogTitle>
        <DialogContent>
          <AttributeForm 
            entityType={isAttributeForCategory ? 'category' : 'connection'}
            onSubmit={handleAddAttribute} 
            onCancel={() => setShowAttributeForm(false)} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// src/components/CategoryForm.tsx

import React, { useState } from 'react';
import { Chip, TextField, Autocomplete, Button, FormControl, FormLabel, Typography } from '@mui/material';
import { Category } from '../types';

interface CategoryFormProps {
  conceptId: string;
  category?: Category;
  onSubmit: (category: Omit<Category, 'category_id' | 'created_at' | 'last_modified'>) => void;
  onCancel: () => void;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({ conceptId, category, onSubmit, onCancel }) => {
  const [name, setName] = useState(category?.name || '');
  const [definition, setDefinition] = useState(category?.definition || '');
  const [extendedDescription, setExtendedDescription] = useState(category?.extended_description || '');
  const [source, setSource] = useState(category?.source || '');
  const [error, setError] = useState<string | null>(null);
  const [traditionConcepts, setTraditionConcepts] = useState<string[]>(category?.tradition_concepts || []);
  const [philosophers, setPhilosophers] = useState<string[]>(category?.philosophers || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!definition.trim()) {
      setError('Definition is required');
      return;
    }
    
	onSubmit({
	  concept_id: conceptId,
      name,
      definition,
      extended_description: extendedDescription || undefined,
      source: source || undefined,
      tradition_concepts: traditionConcepts,
      philosophers: philosophers
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '400px', padding: '15px' }}>
      {error && (
        <Typography color="error" style={{ marginBottom: '15px' }}>
          {error}
        </Typography>
      )}
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Name</FormLabel>
        <TextField
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          fullWidth
          required
          variant="outlined"
        />
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Definition</FormLabel>
        <TextField
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="Enter definition"
          fullWidth
          required
          multiline
          rows={3}
          variant="outlined"
        />
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Extended Description (optional)</FormLabel>
        <TextField
          value={extendedDescription}
          onChange={(e) => setExtendedDescription(e.target.value)}
          placeholder="Enter extended description"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
        />
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Source (optional)</FormLabel>
        <TextField
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Enter source (author, work, tradition)"
          fullWidth
          variant="outlined"
        />
      </FormControl>
      
	  <FormControl fullWidth margin="normal">
		<FormLabel>Traditions/Concepts (optional)</FormLabel>
		<Autocomplete
		  multiple
		  freeSolo
		  options={[]} // Можно добавить предзаданные опции
		  value={traditionConcepts}
		  onChange={(event, newValue) => {
		  setTraditionConcepts(newValue);
		}}
    renderTags={(value, getTagProps) =>
      value.map((option, index) => (
        <Chip
          label={option}
          {...getTagProps({ index })}
          variant="outlined"
        />
      ))
    }
    renderInput={(params) => (
      <TextField
        {...params}
        variant="outlined"
        placeholder="Enter traditions or concepts"
      />
    )}
  />
</FormControl>

<FormControl fullWidth margin="normal">
  <FormLabel>Philosophers (optional)</FormLabel>
  <Autocomplete
    multiple
    freeSolo
    options={[]} // Можно добавить предзаданные опции
    value={philosophers}
    onChange={(event, newValue) => {
      setPhilosophers(newValue);
    }}
    renderTags={(value, getTagProps) =>
      value.map((option, index) => (
        <Chip
          label={option}
          {...getTagProps({ index })}
          variant="outlined"
        />
      ))
    }
    renderInput={(params) => (
      <TextField
        {...params}
        variant="outlined"
        placeholder="Enter philosophers"
      />
    )}
  />
</FormControl>
	  
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <Button 
          type="button" 
          onClick={onCancel} 
          style={{ marginRight: '10px' }}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          color="primary"
        >
          {category ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};

// src/components/ConnectionForm.tsx

import React, { useState, useEffect } from 'react';
import { 
  Chip, 
  TextField, 
  Autocomplete, 
  Button, 
  FormControl, 
  FormLabel, 
  Select, 
  MenuItem, 
  InputLabel,
  Typography,
  SelectChangeEvent
} from '@mui/material';
import { Connection, Category } from '../types';

interface ConnectionFormProps {
  conceptId: string;
  categories: Category[];
  connection?: Connection;
  onSubmit: (connection: Omit<Connection, 'connection_id' | 'created_at' | 'last_modified' | 'source_category' | 'target_category'>) => void;
  onCancel: () => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ 
  conceptId, 
  categories, 
  connection, 
  onSubmit, 
  onCancel 
}) => {
  const [sourceId, setSourceId] = useState(connection?.source_category_id || '');
  const [targetId, setTargetId] = useState(connection?.target_category_id || '');
  const [connectionType, setConnectionType] = useState(connection?.connection_type || '');
  const [direction, setDirection] = useState(connection?.direction || 'directed');
  const [description, setDescription] = useState(connection?.description || '');
  const [error, setError] = useState<string | null>(null);
  const [traditionConcepts, setTraditionConcepts] = useState<string[]>(connection?.tradition_concepts || []);
  const [philosophers, setPhilosophers] = useState<string[]>(connection?.philosophers || []);
  
  // Состояние для типов связей - начинаем с пустого массива
  const [connectionTypes, setConnectionTypes] = useState<string[]>([]);

  // Загрузка существующих типов связей из базы данных
  useEffect(() => {
    const loadConnectionTypes = async () => {
      try {
        const response = await fetch('/api/connections/types');
        if (response.ok) {
          const types = await response.json();
          setConnectionTypes(types);
        }
      } catch (error) {
        console.error('Error loading connection types:', error);
      }
    };
    
    loadConnectionTypes();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sourceId) {
      setError('Source category is required');
      return;
    }
    
    if (!targetId) {
      setError('Target category is required');
      return;
    }
    
    if (sourceId === targetId) {
      setError('Source and target categories must be different');
      return;
    }
    
    if (!connectionType.trim()) {
      setError('Connection type is required');
      return;
    }
    
    onSubmit({
      concept_id: conceptId,
      source_category_id: sourceId,
      target_category_id: targetId,
      connection_type: connectionType,
      direction: direction as any,
      description: description || undefined,
      tradition_concepts: traditionConcepts,
      philosophers: philosophers
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '400px', padding: '15px' }}>
      {error && (
        <Typography color="error" style={{ marginBottom: '15px' }}>
          {error}
        </Typography>
      )}
      
      <FormControl fullWidth margin="normal">
        <InputLabel>Source Category</InputLabel>
        <Select
          value={sourceId}
          onChange={(e: SelectChangeEvent) => setSourceId(e.target.value)}
          label="Source Category"
          required
        >
          {categories.map(category => (
            <MenuItem key={category.category_id} value={category.category_id}>
              {category.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <InputLabel>Target Category</InputLabel>
        <Select
          value={targetId}
          onChange={(e: SelectChangeEvent) => setTargetId(e.target.value)}
          label="Target Category"
          required
        >
          {categories.map(category => (
            <MenuItem key={category.category_id} value={category.category_id}>
              {category.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
		// Улучшенная версия Autocomplete для типов связей:
		<FormControl fullWidth margin="normal">
		  <FormLabel>Connection Type</FormLabel>
		  <Autocomplete
			value={connectionType}
			onChange={(event, newValue) => {
			  setConnectionType(newValue || '');
			}}
			freeSolo
			options={connectionTypes}
			renderInput={(params) => (
			  <TextField
				{...params}
				variant="outlined"
				placeholder="Select from existing types or enter a new one"
				required
			  />
			)}
		  />
		</FormControl>
      
      <FormControl fullWidth margin="normal">
        <InputLabel>Direction</InputLabel>
        <Select
          value={direction}
          onChange={(e: SelectChangeEvent) => setDirection(e.target.value)}
          label="Direction"
          required
        >
          <MenuItem value="directed">Directed</MenuItem>
          <MenuItem value="bidirectional">Bidirectional</MenuItem>
          <MenuItem value="undirected">Undirected</MenuItem>
        </Select>
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Description (optional)</FormLabel>
        <TextField
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
        />
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Traditions/Concepts (optional)</FormLabel>
        <Autocomplete
          multiple
          freeSolo
          options={[]} // Можно добавить предзаданные опции
          value={traditionConcepts}
          onChange={(event, newValue) => {
            setTraditionConcepts(newValue);
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                label={option}
                {...getTagProps({ index })}
                variant="outlined"
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              placeholder="Enter traditions or concepts"
            />
          )}
        />
      </FormControl>

      <FormControl fullWidth margin="normal">
        <FormLabel>Philosophers (optional)</FormLabel>
        <Autocomplete
          multiple
          freeSolo
          options={[]} // Можно добавить предзаданные опции
          value={philosophers}
          onChange={(event, newValue) => {
            setPhilosophers(newValue);
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                label={option}
                {...getTagProps({ index })}
                variant="outlined"
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              placeholder="Enter philosophers"
            />
          )}
        />
      </FormControl>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <Button 
          type="button" 
          onClick={onCancel} 
          style={{ marginRight: '10px' }}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          color="primary"
        >
          {connection ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};

// src/components/AttributeForm.tsx

import React, { useState } from 'react';
import { 
  TextField, 
  Button, 
  FormControl, 
  FormLabel, 
  Select, 
  MenuItem, 
  InputLabel,
  Typography,
  Slider,
  SelectChangeEvent
} from '@mui/material';
import { AttributeCreateDTO } from '../types';

interface AttributeFormProps {
  entityType: 'category' | 'connection';
  onSubmit: (attribute: AttributeCreateDTO) => void;
  onCancel: () => void;
}

export const AttributeForm: React.FC<AttributeFormProps> = ({ 
  entityType, 
  onSubmit, 
  onCancel 
}) => {
  const [attributeType, setAttributeType] = useState('');
  const [value, setValue] = useState<number>(0.5);
  const [justification, setJustification] = useState('');
  const [methodology, setMethodology] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categoryAttributeTypes = [
    { value: 'centrality', label: 'Centrality' },
    { value: 'definiteness', label: 'Definiteness' },
    { value: 'historical_significance', label: 'Historical Significance' }
  ];

  const connectionAttributeTypes = [
    { value: 'strength', label: 'Strength' },
    { value: 'obviousness', label: 'Obviousness' }
  ];

  const attributeTypes = entityType === 'category' 
    ? categoryAttributeTypes 
    : connectionAttributeTypes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!attributeType) {
      setError('Attribute type is required');
      return;
    }
    
    onSubmit({
      attribute_type: attributeType,
      value,
      justification: justification || undefined,
      methodology: methodology || undefined
    });
  };

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    setValue(newValue as number);
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '400px', padding: '15px' }}>
      {error && (
        <Typography color="error" style={{ marginBottom: '15px' }}>
          {error}
        </Typography>
      )}
      
      <FormControl fullWidth margin="normal">
        <InputLabel>Attribute Type</InputLabel>
        <Select
          value={attributeType}
          onChange={(e: SelectChangeEvent) => setAttributeType(e.target.value)}
          label="Attribute Type"
          required
        >
          {attributeTypes.map(type => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Value: {value}</FormLabel>
        <Slider
          value={value}
          onChange={handleSliderChange}
          min={0}
          max={1}
          step={0.01}
          valueLabelDisplay="auto"
        />
        <Typography variant="caption" color="textSecondary">
          Value between 0 and 1
        </Typography>
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Justification (optional)</FormLabel>
        <TextField
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Enter justification for this value"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
        />
      </FormControl>
      
      <FormControl fullWidth margin="normal">
        <FormLabel>Methodology (optional)</FormLabel>
        <TextField
          value={methodology}
          onChange={(e) => setMethodology(e.target.value)}
          placeholder="Enter methodology for determining this value"
          fullWidth
          multiline
          rows={2}
          variant="outlined"
        />
      </FormControl>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <Button 
          type="button" 
          onClick={onCancel} 
          style={{ marginRight: '10px' }}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          color="primary"
        >
          Add Attribute
        </Button>
      </div>
    </form>
  );
};

// src/components/ThesisGenerator.tsx

import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Typography,
  FormControlLabel,
  Switch,
  Divider,
  Tabs,
  Tab,
  Box,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  SelectChangeEvent
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { Thesis, ThesisGenerationParams, Category } from '../types';

interface ThesisGeneratorProps {
  conceptId: string;
}

export const ThesisGenerator: React.FC<ThesisGeneratorProps> = ({ conceptId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [thesesWithWeights, setThesesWithWeights] = useState<Thesis[]>([]);
  const [thesesWithoutWeights, setThesesWithoutWeights] = useState<Thesis[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  const [params, setParams] = useState<Omit<ThesisGenerationParams, 'useWeights'>>({
    count: 5,
    type: 'ontological',
    detail_level: 'medium',
    style: 'academic',
    focus_categories: []
  });
  
  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        // Загрузка категорий
        const categoriesResponse = await fetch(`/api/concepts/${conceptId}/categories`);
        if (!categoriesResponse.ok) {
          throw new Error('Failed to load categories');
        }
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData);
        
        // Загрузка тезисов
        const thesesResponse = await fetch(`/api/concepts/${conceptId}/theses`);
        if (!thesesResponse.ok) {
          throw new Error('Failed to load theses');
        }
        const thesesData = await thesesResponse.json();
        setTheses(thesesData);
        
        // Группировка тезисов по использованию весов
        const withWeights = thesesData.filter((thesis: Thesis) => thesis.used_weights);
        const withoutWeights = thesesData.filter((thesis: Thesis) => !thesis.used_weights);
        
        setThesesWithWeights(withWeights);
        setThesesWithoutWeights(withoutWeights);
      } catch (err) {
        setError(`Error loading data: ${err.message}`);
        console.error('Error loading data:', err);
      }
    };
    
    loadData();
  }, [conceptId]);

  const handleParamChange = (param: string, value: any) => {
    setParams({
      ...params,
      [param]: value
    });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleGenerateTheses = async (useWeights: boolean) => {
    try {
      setLoading(true);
      setError(null);
      
      const generationParams: ThesisGenerationParams = {
        ...params,
        useWeights
      };
      
      const response = await fetch(`/api/concepts/${conceptId}/theses/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(generationParams)
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate theses');
      }
      
      const newTheses = await response.json();
      
      // Обновление списков тезисов
      if (useWeights) {
        setThesesWithWeights([...newTheses, ...thesesWithWeights]);
      } else {
        setThesesWithoutWeights([...newTheses, ...thesesWithoutWeights]);
      }
      
      setTheses([...newTheses, ...theses]);
    } catch (err) {
      setError(`Error generating theses: ${err.message}`);
      console.error('Error generating theses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteThesis = async (thesisId: string) => {
    if (!window.confirm('Are you sure you want to delete this thesis?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/theses/${thesisId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete thesis');
      }
      
      // Обновление списков тезисов
      const updatedTheses = theses.filter(t => t.thesis_id !== thesisId);
      const updatedWithWeights = thesesWithWeights.filter(t => t.thesis_id !== thesisId);
      const updatedWithoutWeights = thesesWithoutWeights.filter(t => t.thesis_id !== thesisId);
      
      setTheses(updatedTheses);
      setThesesWithWeights(updatedWithWeights);
      setThesesWithoutWeights(updatedWithoutWeights);
    } catch (err) {
      setError(`Error deleting thesis: ${err.message}`);
      console.error('Error deleting thesis:', err);
    }
  };

  const handleDevelopThesis = async (thesisId: string) => {
    try {
      const response = await fetch(`/api/theses/${thesisId}/develop`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to develop thesis');
      }
      
      // После успешного развития тезиса можно перенаправить пользователя на страницу с деталями тезиса
      // или обновить данные на текущей странице
      alert('Thesis successfully developed. Check thesis details for more information.');
    } catch (err) {
      setError(`Error developing thesis: ${err.message}`);
      console.error('Error developing thesis:', err);
    }
  };

  const handleCompareTheses = async () => {
    if (thesesWithWeights.length === 0 || thesesWithoutWeights.length === 0) {
      setError('Need theses both with and without weights to compare');
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/theses/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conceptId,
          withWeightsIds: thesesWithWeights.map(t => t.thesis_id),
          withoutWeightsIds: thesesWithoutWeights.map(t => t.thesis_id)
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to compare thesis sets');
      }
      
      const result = await response.json();
      setComparisonResult(result);
      setTabValue(2); // Переключение на вкладку сравнения
    } catch (err) {
      setError(`Error comparing theses: ${err.message}`);
      console.error('Error comparing theses:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="thesis-generator">
      <Card style={{ padding: '20px', marginBottom: '20px' }}>
        <Typography variant="h5" style={{ marginBottom: '20px' }}>
          Thesis Generation Parameters
        </Typography>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <FormControl style={{ minWidth: '200px' }}>
            <InputLabel>Thesis Type</InputLabel>
            <Select
              value={params.type}
              onChange={(e: SelectChangeEvent) => handleParamChange('type', e.target.value)}
              label="Thesis Type"
            >
              <MenuItem value="ontological">Ontological</MenuItem>
              <MenuItem value="epistemological">Epistemological</MenuItem>
              <MenuItem value="ethical">Ethical</MenuItem>
              <MenuItem value="aesthetic">Aesthetic</MenuItem>
              <MenuItem value="political">Political</MenuItem>
              <MenuItem value="metaphysical">Metaphysical</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl style={{ minWidth: '200px' }}>
            <InputLabel>Style</InputLabel>
            <Select
              value={params.style}
              onChange={(e: SelectChangeEvent) => handleParamChange('style', e.target.value)}
              label="Style"
            >
              <MenuItem value="academic">Academic</MenuItem>
              <MenuItem value="popular">Popular</MenuItem>
              <MenuItem value="aphoristic">Aphoristic</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl style={{ minWidth: '200px' }}>
            <InputLabel>Detail Level</InputLabel>
            <Select
              value={params.detail_level}
              onChange={(e: SelectChangeEvent) => handleParamChange('detail_level', e.target.value)}
              label="Detail Level"
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Number of Theses"
            type="number"
            value={params.count}
            onChange={(e) => handleParamChange('count', parseInt(e.target.value))}
            InputProps={{ inputProps: { min: 1, max: 10 } }}
            style={{ width: '150px' }}
          />
        </div>
        
        <FormControl fullWidth style={{ marginTop: '20px' }}>
          <InputLabel>Focus Categories (optional)</InputLabel>
          <Select
            multiple
            value={params.focus_categories || []}
            onChange={(e: SelectChangeEvent<string[]>) => {
              handleParamChange('focus_categories', e.target.value);
            }}
            label="Focus Categories"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((value) => {
                  const category = categories.find(c => c.category_id === value);
                  return <Chip key={value} label={category?.name || value} />;
                })}
              </Box>
            )}
          >
            {categories.map((category) => (
              <MenuItem key={category.category_id} value={category.category_id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleGenerateTheses(true)}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Generate with Weights'}
          </Button>
          
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleGenerateTheses(false)}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Generate without Weights'}
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<CompareArrowsIcon />}
            onClick={handleCompareTheses}
            disabled={thesesWithWeights.length === 0 || thesesWithoutWeights.length === 0 || loading}
          >
            Compare Thesis Sets
          </Button>
        </div>
        
        {error && (
          <Typography color="error" style={{ marginTop: '10px' }}>
            {error}
          </Typography>
        )}
      </Card>
      
      <Tabs value={tabValue} onChange={handleTabChange} style={{ marginBottom: '20px' }}>
        <Tab label="All Theses" />
        <Tab label="By Weight Type" />
        <Tab label="Comparison" disabled={!comparisonResult} />
      </Tabs>
      
      {tabValue === 0 && (
        <Card style={{ padding: '20px' }}>
          <Typography variant="h6" style={{ marginBottom: '15px' }}>
            Generated Theses
          </Typography>
          
          {theses.length === 0 ? (
            <Typography>No theses generated yet. Use the form above to generate theses.</Typography>
          ) : (
            <List>
              {theses.map((thesis) => (
                <React.Fragment key={thesis.thesis_id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={thesis.text}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="textSecondary">
                            Type: {thesis.type} | Style: {thesis.style} | 
                            Using weights: {thesis.used_weights ? 'Yes' : 'No'}
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        onClick={() => handleDevelopThesis(thesis.thesis_id)}
                      >
                        Develop
                      </Button>
                      <IconButton 
                        edge="end" 
                        aria-label="delete"
                        onClick={() => handleDeleteThesis(thesis.thesis_id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </Card>
      )}
      
      {tabValue === 1 && (
        <div style={{ display: 'flex', gap: '20px' }}>
          <Card style={{ padding: '20px', flex: 1 }}>
            <Typography variant="h6" style={{ marginBottom: '15px' }}>
              Theses with Weights
            </Typography>
            
            {thesesWithWeights.length === 0 ? (
              <Typography>No theses with weights generated yet.</Typography>
            ) : (
              <List>
                {thesesWithWeights.map((thesis) => (
                  <React.Fragment key={thesis.thesis_id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={thesis.text}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="textSecondary">
                              Type: {thesis.type} | Style: {thesis.style}
                            </Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          onClick={() => handleDevelopThesis(thesis.thesis_id)}
                        >
                          Develop
                        </Button>
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          onClick={() => handleDeleteThesis(thesis.thesis_id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Card>
          
          <Card style={{ padding: '20px', flex: 1 }}>
            <Typography variant="h6" style={{ marginBottom: '15px' }}>
              Theses without Weights
            </Typography>
            
            {thesesWithoutWeights.length === 0 ? (
              <Typography>No theses without weights generated yet.</Typography>
            ) : (
              <List>
                {thesesWithoutWeights.map((thesis) => (
                  <React.Fragment key={thesis.thesis_id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={thesis.text}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="textSecondary">
                              Type: {thesis.type} | Style: {thesis.style}
                            </Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          onClick={() => handleDevelopThesis(thesis.thesis_id)}
                        >
                          Develop
                        </Button>
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          onClick={() => handleDeleteThesis(thesis.thesis_id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Card>
        </div>
      )}
      
      {tabValue === 2 && comparisonResult && (
        <Card style={{ padding: '20px' }}>
          <Typography variant="h6" style={{ marginBottom: '15px' }}>
            Comparison Analysis
          </Typography>
          
          <Typography variant="subtitle1">General Analysis</Typography>
          <Typography paragraph>{comparisonResult.general_analysis}</Typography>
          
          <Typography variant="subtitle1">Impact of Weights</Typography>
          <Typography paragraph>{comparisonResult.weights_impact}</Typography>
          
          <Typography variant="subtitle1">Evaluation</Typography>
          <Typography paragraph>
            <strong>Better approach: </strong>
            {comparisonResult.evaluation.better_set === 'with_weights' ? 'Using weights' : 
             comparisonResult.evaluation.better_set === 'without_weights' ? 'Without weights' : 
             'Inconclusive'}
          </Typography>
          <Typography paragraph>{comparisonResult.evaluation.explanation}</Typography>
          
          <Typography variant="subtitle1">Specific Examples</Typography>
          <ul>
            {comparisonResult.specific_examples.map((example: string, index: number) => (
              <li key={index}>{example}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

// src/components/SynthesisCreator.tsx

import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Typography,
  FormControlLabel,
  Switch,
  Divider,
  Checkbox,
  ListItemText,
  TextField,
  CircularProgress,
  Paper,
  Box,
  Grid,
  SelectChangeEvent
} from '@mui/material';
import { Concept, SynthesisParams } from '../types';

interface SynthesisCreatorProps {
  userId: string;
  onSynthesisComplete?: (conceptId: string) => void;
}

export const SynthesisCreator: React.FC<SynthesisCreatorProps> = ({ userId, onSynthesisComplete }) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [compatibilityAnalysis, setCompatibilityAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [params, setParams] = useState<SynthesisParams>({
    concept_ids: [],
    synthesis_method: 'integrative',
    innovation_level: 'moderate',
    abstraction_level: 'intermediate',
    historical_context: 'contemporary',
    focus_area: 'ontological',
    use_weights: true
  });

  // Загрузка концепций пользователя
  useEffect(() => {
    const loadConcepts = async () => {
      try {
        const response = await fetch(`/api/users/${userId}/concepts`);
        if (!response.ok) {
          throw new Error('Failed to load concepts');
        }
        const data = await response.json();
        setConcepts(data);
      } catch (err) {
        setError(`Error loading concepts: ${err.message}`);
        console.error('Error loading concepts:', err);
      }
    };
    
    loadConcepts();
  }, [userId]);

  const handleParamChange = (param: string, value: any) => {
    setParams({
      ...params,
      [param]: value
    });
  };

  const handleAnalyzeCompatibility = async () => {
    if (params.concept_ids.length < 2) {
      setError('Please select at least two concepts for synthesis');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/synthesis/compatibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ conceptIds: params.concept_ids })
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze compatibility');
      }
      
      const analysis = await response.json();
      setCompatibilityAnalysis(analysis);
    } catch (err) {
      setError(`Error analyzing compatibility: ${err.message}`);
      console.error('Error analyzing compatibility:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSynthesizeConcepts = async () => {
    if (params.concept_ids.length < 2) {
      setError('Please select at least two concepts for synthesis');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/synthesis/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error('Failed to synthesize concepts');
      }
      
      const result = await response.json();
      
      if (onSynthesisComplete) {
        onSynthesisComplete(result.concept.concept_id);
      }
    } catch (err) {
      setError(`Error synthesizing concepts: ${err.message}`);
      console.error('Error synthesizing concepts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="synthesis-creator">
      <Card style={{ padding: '20px', marginBottom: '20px' }}>
        <Typography variant="h5" style={{ marginBottom: '20px' }}>
          Synthesis Parameters
        </Typography>
        
        <FormControl fullWidth style={{ marginBottom: '20px' }}>
          <InputLabel>Select Concepts</InputLabel>
          <Select
            multiple
            value={params.concept_ids}
            onChange={(e: SelectChangeEvent<string[]>) => {
              handleParamChange('concept_ids', e.target.value);
            }}
            renderValue={(selected) => (
              <div>
                {(selected as string[]).map((conceptId) => {
                  const concept = concepts.find(c => c.concept_id === conceptId);
                  return concept ? concept.name : conceptId;
                }).join(', ')}
              </div>
            )}
          >
            {concepts.map((concept) => (
              <MenuItem key={concept.concept_id} value={concept.concept_id}>
                <Checkbox checked={params.concept_ids.indexOf(concept.concept_id) > -1} />
                <ListItemText primary={concept.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Synthesis Method</InputLabel>
              <Select
                value={params.synthesis_method}
                onChange={(e: SelectChangeEvent) => handleParamChange('synthesis_method', e.target.value)}
                label="Synthesis Method"
              >
                <MenuItem value="dialectical">Dialectical</MenuItem>
                <MenuItem value="integrative">Integrative</MenuItem>
                <MenuItem value="transformational">Transformational</MenuItem>
                <MenuItem value="complementary">Complementary</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Focus Area</InputLabel>
              <Select
                value={params.focus_area}
                onChange={(e: SelectChangeEvent) => handleParamChange('focus_area', e.target.value)}
                label="Focus Area"
              >
                <MenuItem value="ontological">Ontological</MenuItem>
                <MenuItem value="epistemological">Epistemological</MenuItem>
                <MenuItem value="ethical">Ethical</MenuItem>
                <MenuItem value="aesthetic">Aesthetic</MenuItem>
                <MenuItem value="political">Political</MenuItem>
                <MenuItem value="metaphysical">Metaphysical</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Innovation Level</InputLabel>
              <Select
                value={params.innovation_level}
                onChange={(e: SelectChangeEvent) => handleParamChange('innovation_level', e.target.value)}
                label="Innovation Level"
              >
                <MenuItem value="conservative">Conservative</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="radical">Radical</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Abstraction Level</InputLabel>
              <Select
                value={params.abstraction_level}
                onChange={(e: SelectChangeEvent) => handleParamChange('abstraction_level', e.target.value)}
                label="Abstraction Level"
              >
                <MenuItem value="concrete">Concrete</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="abstract">Abstract</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Historical Context</InputLabel>
              <Select
                value={params.historical_context}
                onChange={(e: SelectChangeEvent) => handleParamChange('historical_context', e.target.value)}
                label="Historical Context"
              >
                <MenuItem value="contemporary">Contemporary</MenuItem>
                <MenuItem value="historical">Historical</MenuItem>
                <MenuItem value="timeless">Timeless</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Target Application (optional)"
              fullWidth
              value={params.target_application || ''}
              onChange={(e) => handleParamChange('target_application', e.target.value)}
              placeholder="Describe the intended application or purpose of this synthesis"
              multiline
              rows={2}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={params.use_weights}
                  onChange={(e) => handleParamChange('use_weights', e.target.checked)}
                />
              }
              label="Use Quantitative Weights"
            />
          </Grid>
        </Grid>
        
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            onClick={handleAnalyzeCompatibility}
            disabled={params.concept_ids.length < 2 || loading}
          >
            {loading && compatibilityAnalysis === null ? <CircularProgress size={24} /> : 'Analyze Compatibility'}
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleSynthesizeConcepts}
            disabled={params.concept_ids.length < 2 || loading}
          >
            {loading && compatibilityAnalysis !== null ? <CircularProgress size={24} /> : 'Synthesize Concepts'}
          </Button>
        </div>
        
        {error && (
          <Typography color="error" style={{ marginTop: '10px' }}>
            {error}
          </Typography>
        )}
      </Card>
      
      {compatibilityAnalysis && (
        <Paper style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            Compatibility Analysis
          </Typography>
          
          <Box mb={3}>
            <Typography variant="subtitle1">Fully Compatible Elements</Typography>
            {compatibilityAnalysis.fully_compatible.length === 0 ? (
              <Typography variant="body2">No fully compatible elements found</Typography>
            ) : (
              <ul>
                {compatibilityAnalysis.fully_compatible.map((element: any, index: number) => (
                  <li key={index}>
                    <Typography variant="body2">
                      <strong>{element.name}</strong> ({element.element_type}): {element.compatibility_explanation}
                    </Typography>
                  </li>
                ))}
              </ul>
            )}
          </Box>
          
          <Box mb={3}>
            <Typography variant="subtitle1">Potentially Compatible Elements</Typography>
            {compatibilityAnalysis.potentially_compatible.length === 0 ? (
              <Typography variant="body2">No potentially compatible elements found</Typography>
            ) : (
              <ul>
                {compatibilityAnalysis.potentially_compatible.map((element: any, index: number) => (
                  <li key={index}>
                    <Typography variant="body2">
                      <strong>{element.name}</strong> ({element.element_type}): {element.compatibility_explanation}
                    </Typography>
                  </li>
                ))}
              </ul>
            )}
          </Box>
          
          <Box mb={3}>
            <Typography variant="subtitle1">Incompatible Elements</Typography>
            {compatibilityAnalysis.incompatible.length === 0 ? (
              <Typography variant="body2">No incompatible elements found</Typography>
            ) : (
              <ul>
                {compatibilityAnalysis.incompatible.map((element: any, index: number) => (
                  <li key={index}>
                    <Typography variant="body2">
                      <strong>{element.name}</strong> ({element.element_type}): {element.compatibility_explanation}
                    </Typography>
                  </li>
                ))}
              </ul>
            )}
          </Box>
          
          <Box mb={3}>
            <Typography variant="subtitle1">Recommended Strategies</Typography>
            {compatibilityAnalysis.synthesis_strategies.length === 0 ? (
              <Typography variant="body2">No strategies recommended</Typography>
            ) : (
              <ul>
                {compatibilityAnalysis.synthesis_strategies.map((strategy: any, index: number) => (
                  <li key={index}>
                    <Typography variant="body2">
                      <strong>{strategy.strategy_name}</strong>: {strategy.description}
                    </Typography>
                    {strategy.recommended && (
                      <Typography variant="body2" color="primary">
                        <strong>Recommended</strong>
                      </Typography>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Box>
        </Paper>
      )}
    </div>
  );
};
