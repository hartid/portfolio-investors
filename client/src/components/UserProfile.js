import React, { useState, useEffect } from 'react';
import './UserProfile.css';

const UserProfile = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddAsset, setShowAddAsset] = useState(false);
    const [user, setUser] = useState({
        name: 'hart',
        email: 'hart@example.com',
        avatar: 'https://images.steamusercontent.com/ugc/2008090573113301234/79CF9894EBA237A11223EF2457DD84E821A96912/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true',
        joinDate: '2024-01-15',
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

    const DEFAULT_PORTFOLIO_ID = 1;
    const getToken = () => localStorage.getItem('token');

    // Универсальная функция для API запросов
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

    useEffect(() => {
        initPortfolioAndAssets();
    }, []);
    // Инициализация портфолио и активов
    const initPortfolioAndAssets = async () => {
        try {
            const portfolios = await apiRequest('/api/portfolios');
            const portfolioId = portfolios.length > 0
                ? portfolios[0].id
                : (await apiRequest('/api/portfolios', { method: 'POST', body: JSON.stringify({ name: 'Мои инвестиции' }) })).id;

            await fetchAssets(portfolioId);
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            setAssets([]);
        } finally {
            setLoading(false);
        }
    };
    // Активы
    const fetchAssets = async (portfolioId) => {
        try {
            const data = await apiRequest(`/api/assets/${portfolioId}`);
            const assetsArray = Array.isArray(data) ? data : [];
            setAssets(assetsArray);
            calculateTotalStats(assetsArray);
        } catch (error) {
            console.error('Ошибка загрузки активов:', error);
            setAssets([]);
        }
    };
    // Подсчет денег
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
    // Добавление актива
    const addAsset = async (e) => {
        e.preventDefault();

        if (!newAsset.name || !newAsset.quantity || !newAsset.purchase_price) {
            alert('Заполните обязательные поля');
            return;
        }

        try {
            const portfolios = await apiRequest('/api/portfolios');
            const portfolioId = portfolios[0]?.id || DEFAULT_PORTFOLIO_ID;

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

            // Сброс формы
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
    // Удаление актива
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
    // Типы активов
    const assetTypes = {
        stock: { label: '📈 Акции', color: '#4caf50', icon: '📈' },
        crypto: { label: '₿ Криптовалюта', color: '#ff9800', icon: '₿' },
        real_estate: { label: '🏠 Недвижимость', color: '#2196f3', icon: '🏠' },
        bond: { label: '📜 Облигации', color: '#9c27b0', icon: '📜' },
        other: { label: '💼 Другое', color: '#607d8b', icon: '💼' }
    };

    if (loading) return <div className="loading">Загрузка...</div>;

    return (
        <div className="user-profile">
            {/* Шапка профиля */}
            <div className="profile-header">
                <div className="profile-cover"></div>
                <div className="profile-info">
                    <img src={user.avatar} alt="Avatar" className="profile-avatar" />
                    <div className="profile-details">
                        <h1>{user.name}</h1>
                        <p className="profile-email">{user.email}</p>
                        <p className="profile-join">Участник с {new Date(user.joinDate).toLocaleDateString('ru')}</p>
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
                </div>
            </div>

            <div className="profile-content">
                <div className="assets-container">
                    <div className="assets-header">
                        <h2>Мои активы</h2>
                        <button onClick={() => setShowAddAsset(true)} className="btn-primary">+ Добавить актив</button>
                    </div>

                    {/* Модальное окно */}
                    {showAddAsset && (
                        <div className="modal-overlay" onClick={() => setShowAddAsset(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <h3>Добавить актив</h3>
                                <form onSubmit={addAsset} className="asset-form">
                                    {/* Форма */}
                                    <div className="form-row">
                                        <select value={newAsset.asset_type} onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value })} className="form-input" required>
                                            {Object.entries(assetTypes).map(([value, { label }]) => (<option key={value} value={value}>{label}</option>))}
                                        </select>
                                        <input type="text" placeholder="Символ (AAPL, BTC)" value={newAsset.symbol} onChange={(e) => setNewAsset({ ...newAsset, symbol: e.target.value.toUpperCase() })} className="form-input" />
                                    </div>
                                    <input type="text" placeholder="Название *" value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} className="form-input" required />
                                    <div className="form-row">
                                        <input type="number" placeholder="Количество *" value={newAsset.quantity} onChange={(e) => setNewAsset({ ...newAsset, quantity: e.target.value })} className="form-input" required />
                                        <input type="number" placeholder="Цена покупки *" value={newAsset.purchase_price} onChange={(e) => setNewAsset({ ...newAsset, purchase_price: e.target.value })} className="form-input" required />
                                        <input type="number" placeholder="Текущая цена" value={newAsset.current_price} onChange={(e) => setNewAsset({ ...newAsset, current_price: e.target.value })} className="form-input" />
                                    </div>
                                    <input type="date" value={newAsset.purchase_date} onChange={(e) => setNewAsset({ ...newAsset, purchase_date: e.target.value })} className="form-input" />
                                    <textarea placeholder="Заметки" value={newAsset.notes} onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })} className="form-textarea" />
                                    <div className="form-actions">
                                        <button type="submit" className="btn-success">Сохранить</button>
                                        <button type="button" onClick={() => setShowAddAsset(false)} className="btn-secondary">Отмена</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Список активов */}
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
                                        <div className="detail-item"><span>Количество:</span><strong>{quantity}</strong></div>
                                        <div className="detail-item"><span>Цена покупки:</span><strong>${purchasePrice.toLocaleString()}</strong></div>
                                        <div className="detail-item"><span>Текущая цена:</span><strong>${currentPrice.toLocaleString()}</strong></div>
                                        <div className="detail-item"><span>Стоимость:</span><strong>${totalValue.toLocaleString()}</strong></div>
                                        <div className={`detail-item profit ${profit >= 0 ? 'positive' : 'negative'}`}>
                                            <span>Прибыль:</span><strong>${profit.toLocaleString()} ({profitPercent.toFixed(2)}%)</strong>
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