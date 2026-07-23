import React, { useState, useEffect } from 'react';
import ProfitChart from './ProfitChart';
import TwoFactorSetup from './TwoFactorSetup';
import './UserProfile.css';
import { fetchCryptoPrice } from '../services/priceApi';

const UserProfile = () => {
    // ============ STATE ============
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddAsset, setShowAddAsset] = useState(false);
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

    const [user, setUser] = useState({
        name: '',
        email: '',
        avatar: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRcAvMUPN4d-4aMzQovh_PnlhFZYr1wbhaEAw&s',
        joinDate: '',
        totalInvested: 0,
        totalProfit: 0
    });

    const [newAsset, setNewAsset] = useState({
        asset_type: 'stock',
        symbol: '',
        name: '',
        quantity: '',
        purchase_price: '',
        current_price: '',
        purchase_date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    // ============ HELPER FUNCTIONS ============
    const getToken = () => localStorage.getItem('token');

    const apiRequest = async (endpoint, options = {}) => {
        const token = getToken();
        const response = await fetch(`http://localhost:5000${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    };

    // ============ USER DATA ============
    const fetchUserData = async () => {
        try {
            const data = await apiRequest('/api/me');
            setUser(prev => ({
                ...prev,
                name: data.username,
                email: data.email,
                joinDate: data.created_at?.split('T')[0] || '2024-01-15'
            }));
            setTwoFactorEnabled(data.two_factor_enabled || false);
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
        }
    };

    // ============ ASSETS CRUD ============
    const fetchAssets = async () => {
        try {
            const portfolios = await apiRequest('/api/portfolios');
            if (portfolios.length > 0) {
                const data = await apiRequest(`/api/assets/${portfolios[0].id}`);
                const assetsArray = Array.isArray(data) ? data : [];
                setAssets(assetsArray);
                calculateTotalStats(assetsArray);
                await updateCryptoPrices(assetsArray); 
            }
        } catch (error) {
            console.error('Ошибка загрузки активов:', error);
            setAssets([]);
        }
    };

    const calculateTotalStats = (assetsList) => {
        if (!Array.isArray(assetsList)) return;

        let totalInvested = 0;
        let totalCurrent = 0;

        assetsList.forEach(asset => {
            const quantity = Number(asset.quantity) || 0;
            const purchasePrice = Number(asset.purchase_price) || 0;
            const currentPrice = Number(asset.current_price) || purchasePrice;

            totalInvested += quantity * purchasePrice;
            totalCurrent += quantity * currentPrice;
        });

        setUser(prev => ({
            ...prev,
            totalInvested,
            totalProfit: totalCurrent - totalInvested
        }));
    };

    const addAsset = async (e) => {
        e.preventDefault();

        if (!newAsset.name || !newAsset.quantity || !newAsset.purchase_price) {
            alert('Заполните обязательные поля');
            return;
        }

        try {
            const portfolios = await apiRequest('/api/portfolios');
            const portfolioId = portfolios[0]?.id || 1;

            const asset = await apiRequest('/api/assets', {
                method: 'POST',
                body: JSON.stringify({
                    ...newAsset,
                    portfolio_id: portfolioId,
                    quantity: parseFloat(newAsset.quantity),
                    purchase_price: parseFloat(newAsset.purchase_price),
                    current_price: newAsset.current_price ? parseFloat(newAsset.current_price) : null
                })
            });

            const updatedAssets = [asset, ...assets];
            setAssets(updatedAssets);
            calculateTotalStats(updatedAssets);
            setShowAddAsset(false);

            setNewAsset({
                asset_type: 'stock',
                symbol: '',
                name: '',
                quantity: '',
                purchase_price: '',
                current_price: '',
                purchase_date: new Date().toISOString().split('T')[0],
                notes: ''
            });
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при добавлении актива: ' + error.message);
        }
    };

    const updateCryptoPrices = async (assetsList) => {
        const cryptoAssets = assetsList.filter(a => a.asset_type === 'crypto' && a.symbol);
        if (cryptoAssets.length === 0) {
            alert('Нет криптовалют для обновления');
            return;
        }

        setLoading(true);
        const updatedAssets = [...assetsList];
        let updatedCount = 0;

        for (const asset of cryptoAssets) {
            try {
                const price = await fetchCryptoPrice(asset.symbol);
                if (price && price !== asset.current_price) {
                    // Обновляем локально
                    const index = updatedAssets.findIndex(a => a.id === asset.id);
                    if (index !== -1) {
                        updatedAssets[index] = { ...updatedAssets[index], current_price: price };
                        updatedCount++;
                    }

                    // Отправляем на сервер (не ждем ответа)
                    fetch(`http://localhost:5000/api/assets/${asset.id}/price`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${getToken()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ current_price: price })
                    }).catch(err => console.error(`Ошибка сохранения ${asset.symbol}:`, err));
                }
            } catch (err) {
                console.error(`Ошибка обновления ${asset.symbol}:`, err);
            }
        }

        // Обновляем состояние сразу, не дожидаясь сервера
        setAssets(updatedAssets);
        calculateTotalStats(updatedAssets);
        setLoading(false);

    };

    const deleteAsset = async (id) => {
        if (!window.confirm('Удалить актив?')) return;

        try {
            await apiRequest(`/api/assets/${id}`, { method: 'DELETE' });
            const updatedAssets = assets.filter(a => a.id !== id);
            setAssets(updatedAssets);
            calculateTotalStats(updatedAssets);
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при удалении');
        }
    };

    // ============ INIT ============
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await fetchUserData();
                await fetchAssets();
            } catch (error) {
                console.error('Ошибка инициализации:', error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // ============ TYPES ============
    const assetTypes = {
        stock: { label: '📈 Акции', color: '#4caf50', icon: '📈' },
        crypto: { label: '₿ Криптовалюта', color: '#ff9800', icon: '₿' },
        real_estate: { label: '🏠 Недвижимость', color: '#2196f3', icon: '🏠' },
        bond: { label: '📜 Облигации', color: '#9c27b0', icon: '📜' },
        other: { label: '💼 Другое', color: '#607d8b', icon: '💼' }
    };

    // ============ RENDER ============
    if (loading) return <div className="loading">Загрузка...</div>;

    return (
        <div className="user-profile">
            {/* ШАПКА ПРОФИЛЯ */}
            <div className="profile-header">
                <div className="profile-cover"></div>
                <div className="profile-info">
                    <img src={user.avatar} alt="Avatar" className="profile-avatar" />
                    <div className="profile-details">
                        <h1>{user.name}</h1>
                        <p className="profile-email">{user.email}</p>
                        <p className="profile-join">Участник с {user.joinDate}</p>
                    </div>

                    <div className="profile-stats">
                        <div className="stat-card">
                            <span className="stat-label">Активов</span>
                            <span className="stat-value">{assets.length}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Инвестировано</span>
                            <span className="stat-value">${user.totalInvested.toLocaleString()}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Прибыль</span>
                            <span className={`stat-value ${user.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                                ${user.totalProfit.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* КОМПАКТНЫЙ БЛОК 2FA */}
                    <div className="twofa-compact">
                        <span className="twofa-icon">🔐</span>
                        <span className="twofa-text">2FA</span>
                        <span className={`twofa-status ${twoFactorEnabled ? 'enabled' : 'disabled'}`}>
                            {twoFactorEnabled ? '✓' : '✗'}
                        </span>
                        <button
                            onClick={() => setShow2FAModal(true)}
                            className="twofa-btn"
                            title={twoFactorEnabled ? 'Управлять 2FA' : 'Настроить 2FA'}
                        >
                            ⚙️
                        </button>
                    </div>
                </div>
            </div>

            {/* ОСНОВНОЙ КОНТЕНТ */}
            <div className="profile-content">
                <div className="assets-container">
                    <div className="assets-header">
                        <h2>Мои активы</h2>
                        <div className="header-buttons">
                            <button onClick={() => setShowAddAsset(true)} className="btn-primary">
                                + Добавить актив
                            </button>
                        </div>
                    </div>

                    <ProfitChart assets={assets} />

                    {/* МОДАЛЬНЫЕ ОКНА */}
                    {show2FAModal && (
                        <TwoFactorSetup
                            onClose={() => setShow2FAModal(false)}
                            onEnabled={() => {
                                setTwoFactorEnabled(true);
                                setShow2FAModal(false);
                            }}
                        />
                    )}

                    {showAddAsset && (
                        <div className="modal-overlay" onClick={() => setShowAddAsset(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <h3>Добавить актив</h3>
                                <form onSubmit={addAsset} className="asset-form">
                                    <div className="form-row">
                                        <select
                                            value={newAsset.asset_type}
                                            onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value })}
                                            className="form-input"
                                            required
                                        >
                                            {Object.entries(assetTypes).map(([value, { label }]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Символ (BTC, ETH)"
                                            value={newAsset.symbol}
                                            onChange={(e) => setNewAsset({ ...newAsset, symbol: e.target.value.toUpperCase() })}
                                            className="form-input"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Название *"
                                        value={newAsset.name}
                                        onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                                        className="form-input"
                                        required
                                    />
                                    <div className="form-row">
                                        <input
                                            type="number"
                                            placeholder="Количество *"
                                            value={newAsset.quantity}
                                            onChange={(e) => setNewAsset({ ...newAsset, quantity: e.target.value })}
                                            className="form-input"
                                            required
                                        />
                                        <input
                                            type="number"
                                            placeholder="Цена покупки *"
                                            value={newAsset.purchase_price}
                                            onChange={(e) => setNewAsset({ ...newAsset, purchase_price: e.target.value })}
                                            className="form-input"
                                            required
                                        />
                                        <input
                                            type="number"
                                            placeholder="Текущая цена"
                                            value={newAsset.current_price}
                                            onChange={(e) => setNewAsset({ ...newAsset, current_price: e.target.value })}
                                            className="form-input"
                                        />
                                    </div>
                                    <input
                                        type="date"
                                        value={newAsset.purchase_date}
                                        onChange={(e) => setNewAsset({ ...newAsset, purchase_date: e.target.value })}
                                        className="form-input"
                                    />
                                    <textarea
                                        placeholder="Заметки"
                                        value={newAsset.notes}
                                        onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })}
                                        className="form-textarea"
                                    />
                                    <div className="form-actions">
                                        <button type="submit" className="btn-success">Сохранить</button>
                                        <button type="button" onClick={() => setShowAddAsset(false)} className="btn-secondary">Отмена</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* СПИСОК АКТИВОВ */}
                    <div className="assets-grid">
                        {assets.map(asset => {
                            const quantity = Number(asset.quantity) || 0;
                            const purchasePrice = Number(asset.purchase_price) || 0;
                            const currentPrice = Number(asset.current_price) || purchasePrice;
                            const totalValue = quantity * currentPrice;
                            const profit = (currentPrice - purchasePrice) * quantity;
                            const profitPercent = purchasePrice > 0 ? ((currentPrice / purchasePrice) - 1) * 100 : 0;

                            return (
                                <div key={asset.id} className="asset-card">
                                    <div className="asset-card-header">
                                        <div className="asset-type-icon" style={{ background: assetTypes[asset.asset_type]?.color || '#666' }}>
                                            {assetTypes[asset.asset_type]?.icon || '💰'}
                                        </div>
                                        <div className="asset-info">
                                            <h4>{asset.name || 'Без названия'}</h4>
                                            {asset.symbol && <span className="asset-symbol">{asset.symbol}</span>}
                                            <span className="asset-type-label">{assetTypes[asset.asset_type]?.label || 'Другое'}</span>
                                        </div>
                                        <button onClick={() => deleteAsset(asset.id)} className="btn-delete" title="Удалить">🗑️</button>
                                    </div>
                                    <div className="asset-details">
                                        <div className="detail-item">
                                            <span>Количество:</span>
                                            <strong>{quantity}</strong>
                                        </div>
                                        <div className="detail-item">
                                            <span>Цена покупки:</span>
                                            <strong>${purchasePrice.toLocaleString()}</strong>
                                        </div>
                                        <div className="detail-item">
                                            <span>Текущая цена:</span>
                                            <strong>${currentPrice.toLocaleString()}</strong>
                                        </div>
                                        <div className="detail-item">
                                            <span>Стоимость:</span>
                                            <strong>${totalValue.toLocaleString()}</strong>
                                        </div>
                                        <div className={`detail-item profit ${profit >= 0 ? 'positive' : 'negative'}`}>
                                            <span>Прибыль:</span>
                                            <strong>${profit.toLocaleString()} ({profitPercent.toFixed(2)}%)</strong>
                                        </div>
                                    </div>
                                    {asset.notes && <div className="asset-notes">📝 {asset.notes}</div>}
                                </div>
                            );
                        })}
                    </div>

                    {assets.length === 0 && (
                        <div className="empty-state">
                            <p>📭 У вас пока нет активов</p>
                            <p>Нажмите кнопку "+ Добавить актив" чтобы начать</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfile;