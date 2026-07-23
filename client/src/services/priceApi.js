import axios from 'axios';

// Базовые URL для API
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Маппинг символов криптовалют для CoinGecko
const cryptoMapping = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'SOL': 'solana',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'SHIB': 'shiba-inu',
    'TRX': 'tron',
    'AVAX': 'avalanche-2',
    'UNI': 'uniswap',
    'LINK': 'chainlink',
    'LTC': 'litecoin',
    'ETC': 'ethereum-classic',
    'XLM': 'stellar',
    'ATOM': 'cosmos',
    'ALGO': 'algorand',
    'VET': 'vechain'
};

// Кэш для цен
let priceCache = {};
let lastFetchTime = {};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Получить текущую цену криптовалюты
 */
export const fetchCryptoPrice = async (symbol, retryCount = 0) => {
    const symbolUpper = symbol.toUpperCase();

    // Проверяем кэш 
    if (priceCache[symbolUpper] && Date.now() - lastFetchTime[symbolUpper] < 5 * 60 * 1000) {
        return priceCache[symbolUpper];
    }

    const coinId = cryptoMapping[symbolUpper];
    if (!coinId) {
        console.warn(`Неизвестная криптовалюта: ${symbolUpper}`);
        return null;
    }

    try {
        const response = await axios.get(`${COINGECKO_API}/simple/price`, {
            params: {
                ids: coinId,
                vs_currencies: 'usd'
            }
        });

        const price = response.data[coinId]?.usd;
        if (price) {
            priceCache[symbolUpper] = price;
            lastFetchTime[symbolUpper] = Date.now();
            return price;
        }
        return null;
    } catch (error) {
        console.error(`Ошибка получения цены ${symbolUpper}:`, error.message);

        if (retryCount < 3) {
            await delay(1000 * (retryCount + 1));
            return fetchCryptoPrice(symbol, retryCount + 1);
        }
        return null;
    }
};

/**
 * Обновить все цены криптовалют
 */
export const updateAllPrices = async (assets, onProgress) => {
    const cryptoAssets = assets.filter(a => a.asset_type === 'crypto' && a.symbol);

    const updatedPrices = [];

    for (let i = 0; i < cryptoAssets.length; i++) {
        const asset = cryptoAssets[i];
        const price = await fetchCryptoPrice(asset.symbol);
        if (price !== null) {
            updatedPrices.push({ id: asset.id, price });
        }
        if (onProgress) {
            onProgress({
                current: i + 1,
                total: cryptoAssets.length,
                symbol: asset.symbol
            });
        }
        await delay(100);
    }

    return updatedPrices;
};

/**
 * Очистить кэш цен
 */
export const clearPriceCache = () => {
    priceCache = {};
    lastFetchTime = {};
};

export default {
    fetchCryptoPrice,
    updateAllPrices,
    clearPriceCache
};