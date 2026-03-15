import React, { useState } from 'react';
import InputAI from './components/inputAI';
import AIList from './components/AIList';
import './App.css';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="app-container">
      <div className="app-content">
        <header className="app-header">
          <h1 className="app-title">
            Библиотека ИИ-моделей
          </h1>
          <p className="app-subtitle">
            Каталог лучших искусственных интеллектов для ваших проектов
          </p>
        </header>

        <div className="app-card">
          <InputAI onSuccess={() => setRefreshKey(prev => prev + 1)} />
        </div>

        <div className="app-card">
          <AIList key={refreshKey} />
        </div>
      </div>
    </div>
  );
}

export default App;