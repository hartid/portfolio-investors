import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
    const [tempUserId, setTempUserId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Если уже прошли первый этап и вводим 2FA код
        if (requiresTwoFactor) {
            await submitTwoFactor();
            return;
        }

        // Обычный вход или регистрация
        const endpoint = isLogin ? '/api/login' : '/api/register';
        const payload = isLogin
            ? { username: formData.username, password: formData.password }
            : { username: formData.username, email: formData.email, password: formData.password };

        try {
            const response = await fetch(`http://localhost:5000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка');
            }

            // Если требуется 2FA (специальный ответ от сервера)
            if (data.requiresTwoFactor) {
                setRequiresTwoFactor(true);
                setTempUserId(data.userId);
                setLoading(false);
                return;
            }

            // Успешный вход без 2FA
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.user);

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // Отправка 2FA кода
    const submitTwoFactor = async () => {
        if (!twoFactorCode || twoFactorCode.length !== 6) {
            setError('Введите 6-значный код');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    password: formData.password,
                    twoFactorCode: twoFactorCode
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Неверный код');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.user);

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setTwoFactorCode('');
        setRequiresTwoFactor(false);
    };

    // Экран ввода 2FA кода
    if (requiresTwoFactor) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <h2>🔐 Двухфакторная аутентификация</h2>
                    <p>Введите код из приложения Google Authenticator</p>

                    <input
                        type="text"
                        placeholder="000000"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.slice(0, 6))}
                        maxLength={6}
                        className="twofactor-input"
                        autoFocus
                    />

                    {error && <div className="error-message">{error}</div>}

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="submit-btn"
                    >
                        {loading ? 'Проверка...' : 'Подтвердить'}
                    </button>

                    <p className="back-link" onClick={switchMode}>
                        ← Вернуться к входу
                    </p>
                </div>
            </div>
        );
    }

    // Обычная форма входа/регистрации
    return (
        <div className="login-container">
            <div className="login-card">
                <h2>{isLogin ? 'Вход' : 'Регистрация'}</h2>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Имя пользователя"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                    />

                    {!isLogin && (
                        <input
                            type="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    )}

                    <input
                        type="password"
                        placeholder="Пароль"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                    />

                    <button type="submit" disabled={loading} className="submit-btn">
                        {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
                    </button>
                </form>

                <p onClick={switchMode} className="toggle-auth">
                    {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
                </p>
            </div>
        </div>
    );
};

export default Login;