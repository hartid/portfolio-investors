import React, { useState, useEffect } from 'react';
import UserProfile from './components/UserProfile';
import Login from './components/Login';
import './App.css';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            setIsAuthenticated(true);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const handleLogin = (userData) => {
        setIsAuthenticated(true);
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
    };

    if (loading) {
        return <div className="loading">Загрузка...</div>;
    }

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="app-container">
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '20px',
                background: '#0a0a0a'
            }}>
                <button
                    onClick={handleLogout}
                    style={{
                        background: '#1a1a2e',
                        color: '#fff',
                        border: '1px solid #2a2a3a',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Выйти ({user?.username})
                </button>
            </div>
            <UserProfile />
        </div>
    );
}

export default App;