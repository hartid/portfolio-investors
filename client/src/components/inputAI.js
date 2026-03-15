import React, { useState } from 'react';
import './InputAI.css';

const InputAI = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmitForm = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch("http://localhost:5000/api/ai_models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description })
      });

      if (!response.ok) throw new Error('Ошибка сервера');
      
      setName('');
      setDescription('');
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Ошибка при добавлении: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="input-ai-container">
      <h2 className="input-ai-title">Добавить новую модель</h2>
      <form onSubmit={onSubmitForm} className="input-ai-form">
        <div className="input-ai-field">
          <label className="input-ai-label">Название модели</label>
          <input
            type="text"
            className="input-ai-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: GPT-4"
            required
          />
        </div>
        
        <div className="input-ai-field">
          <label className="input-ai-label">Описание</label>
          <textarea
            className="input-ai-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание возможностей модели"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`input-ai-submit ${isSubmitting ? 'submitting' : ''}`}
        >
          {isSubmitting ? (
            <span className="input-ai-spinner-wrapper">
              <span className="input-ai-spinner"></span>
              Добавляем...
            </span>
          ) : 'Добавить модель'}
        </button>
      </form>
    </div>
  );
};

export default InputAI;