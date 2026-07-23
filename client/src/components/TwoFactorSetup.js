import React, { useState } from 'react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import './TwoFactorSetup.css';


const TwoFactorSetup = ({ onClose, onEnabled }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');

  const getToken = () => localStorage.getItem('token');

  // Получить секрет и QR-код
  const setup2FA = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('http://localhost:5000/api/2fa/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSecret(data.secret);
        setQrCode(data.qrCode);
        setBackupCodes(data.backupCodes);
        setStep(2);
      } else {
        setError(data.error || 'Ошибка настройки');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  // Шаг 2: Проверить код и активировать 2FA
  const verify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('http://localhost:5000/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: verificationCode })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStep(3);
        onEnabled();
      } else {
        setError(data.error || 'Неверный код');
      }
    } catch (err) {
      setError('Ошибка проверки');
    } finally {
      setLoading(false);
    }
  };

  // Скачать резервные коды
  const downloadCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'backup_codes.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Информация и кнопка старта
  if (step === 1) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>×</button>
          <h2>🔐 Двухфакторная аутентификация</h2>
          
          <p>Защитите аккаунт дополнительным кодом из приложения-аутентификатора.</p>
          
          <ul className="benefits">
            <li>✓ Код обновляется каждые 30 секунд</li>
            <li>✓ Работает с Google Authenticator</li>
            <li>✓ 10 резервных кодов для восстановления</li>
          </ul>
          
          {error && <div className="error-msg">{error}</div>}
          
          <button 
            onClick={setup2FA} 
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Загрузка...' : 'Начать настройку'}
          </button>
        </div>
      </div>
    );
  }

  // Настройка (QR-код + ввод кода)
  if (step === 2) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>×</button>
          <h2>📱 Настройка 2FA</h2>
          
          <p>1. Установите <strong>Google Authenticator</strong> из магазина приложений</p>
          
          <p>2. Отсканируйте QR-код:</p>
          <div className="qr-wrapper">
            {qrCode && <QRCode value={qrCode} size={180} />}
          </div>
          
          <p>или введите код вручную:</p>
          <code className="secret-code">{secret}</code>
          
          <p>3. Введите код из приложения:</p>
          <input
            type="text"
            placeholder="000000"
            value={verificationCode}
            onChange={e => setVerificationCode(e.target.value.slice(0, 6))}
            maxLength={6}
            className="code-input"
            autoFocus
          />
          
          {error && <div className="error-msg">{error}</div>}
          
          <div className="modal-buttons">
            <button onClick={verify2FA} disabled={loading} className="btn-primary">
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
            <button onClick={() => setStep(1)} className="btn-secondary">
              Назад
            </button>
          </div>
        </div>
      </div>
    );
  }

  //Успех и резервные коды
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="success-icon">✓</div>
        <h2>2FA успешно настроена!</h2>
        
        <div className="warning-box">
          ⚠️ Сохраните резервные коды в надежном месте!
        </div>
        
        <div className="backup-grid">
          {backupCodes.map((code, i) => (
            <span key={i} className="backup-code">{code}</span>
          ))}
        </div>
        
        <div className="modal-buttons">
          <button onClick={downloadCodes} className="btn-secondary">
            💾 Скачать коды
          </button>
          <button onClick={onClose} className="btn-primary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;