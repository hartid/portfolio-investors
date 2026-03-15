// AIList.js
import React, { useState, useEffect } from 'react';
import './AIList.css';
import { format, parseISO } from 'date-fns';

const AIList = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/ai_models');
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить эту модель?')) return;
    
    try {
      await fetch(`http://localhost:5000/api/ai_models/${id}`, { 
        method: 'DELETE' 
      });
      setModels(models.filter(model => model.id !== id));
    } catch (error) {
      console.error('Ошибка удаления:', error);
    }
  };

  const startEditing = (model) => {
    setEditingId(model.id);
    setEditForm({
      name: model.name,
      description: model.description,
      updated_at: model.updated_at
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
  try {
    const updatedData = {
      ...editForm,
      updated_at: new Date().toISOString()
    };
    
    const response = await fetch(`http://localhost:5000/api/ai_models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    
    const updatedModel = await response.json();
    setModels(models.map(model => 
      model.id === id ? { ...updatedModel, updated_at: new Date().toISOString() } : model
    ));
    setEditingId(null);
  } catch (error) {
    console.error('Ошибка обновления:', error);
  }
};

  if (loading) return (
    <div className="flex justify-center items-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
    </div>
  );

  return (
    <div className="ai-container">
      <h2 className="ai-title">Библиотека нейросетей</h2>
      
      {models.length === 0 ? (
        <div className="ai-empty">
          <p className="ai-empty-text">Нет добавленных моделей</p>
        </div>
      ) : (
        <div className="ai-models-grid">
          {models.map((model) => (
            <div 
              key={model.id} 
              className={`ai-model-square ${editingId === model.id ? 'editing' : ''}`}
            >
              {editingId === model.id ? (
                <div className="ai-edit-form">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="ai-edit-input"
                    placeholder="Название"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="ai-edit-textarea"
                    placeholder="Описание"
                  />
                  <div className="ai-edit-buttons">
                    <button onClick={() => handleUpdate(model.id)} className="ai-square-btn save">
                      ✓
                    </button>
                    <button onClick={cancelEditing} className="ai-square-btn cancel">
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ai-square-content">
                  <div className="ai-square-header">
  <h3 className="ai-square-name">{model.name}</h3>
  {model.updated_at && (
    <span className="ai-square-time" title="Последнее изменение">
      {format(parseISO(model.updated_at), 'dd.MM.yyyy HH:mm')}
    </span>
  )}
</div>
                  <p className="ai-square-description">{model.description}</p>
                  <div className="ai-square-actions">
                    <button
                      onClick={() => startEditing(model)}
                      className="ai-square-btn edit"
                      aria-label="Редактировать"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(model.id)}
                      className="ai-square-btn delete"
                      aria-label="Удалить"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIList;