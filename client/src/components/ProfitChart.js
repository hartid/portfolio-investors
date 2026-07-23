import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './ProfitChart.css';

const ProfitChart = ({ assets }) => {
    const chartData = useMemo(() => {
        if (!assets || assets.length === 0) return [];

        
        const sorted = [...assets].sort((a, b) =>
            new Date(a.purchase_date || a.created_at) - new Date(b.purchase_date || b.created_at)
        );

        let totalInvested = 0;
        let totalCurrent = 0;
        const result = [];

        sorted.forEach(asset => {
            const qty = Number(asset.quantity) || 0;
            const buyPrice = Number(asset.purchase_price) || 0;
            const curPrice = Number(asset.current_price) || buyPrice;

            totalInvested += qty * buyPrice;
            totalCurrent += qty * curPrice;

            const date = asset.purchase_date || asset.created_at;

            result.push({
                date: new Date(date).toLocaleDateString('ru'),
                value: totalCurrent,
                invested: totalInvested
            });
        });

        return result;
    }, [assets]);

    if (chartData.length === 0) {
        return <div className="profit-chart-empty">Нет данных</div>;
    }

    // Если только одна точка, график не имеет смысла
    if (chartData.length === 1) {
        return (
            <div className="profit-chart-empty">
                <p>📊 Добавьте активы с разными датами покупки</p>
                <small>График покажет динамику после нескольких покупок</small>
            </div>
        );
    }

    const last = chartData[chartData.length - 1];
    const profit = last.value - last.invested;
    const percent = last.invested ? (profit / last.invested * 100).toFixed(1) : 0;

    return (
        <div className="profit-chart">
            <div className="profit-stats-simple">
                <div>
                    <span>💰</span>
                    <strong>${last.value.toLocaleString()}</strong>
                </div>
                <div className={profit >= 0 ? 'positive' : 'negative'}>
                    <span>{profit >= 0 ? '📈' : '📉'}</span>
                    <strong>{profit >= 0 ? '+' : ''}{profit.toLocaleString()} ({percent}%)</strong>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip
                        formatter={(v) => `$${v.toLocaleString()}`}
                        contentStyle={{ background: '#1e1e2e', border: 'none', borderRadius: 8 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#4caf50"
                        strokeWidth={3}
                        dot={{ fill: '#4caf50', r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="invested"
                        stroke="#666"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ProfitChart;