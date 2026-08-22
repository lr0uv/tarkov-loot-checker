'use client';
import { useState, useEffect } from 'react';
import { fetchTarkovItems, TarkovItem } from '../lib/api';

export default function LootChecker() {
  const [items, setItems] = useState<TarkovItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TarkovItem | null>(null);

  useEffect(() => {
    fetchTarkovItems('ja').then((data) => setItems(data));
  }, []);

  const getSlotValue = (item: TarkovItem) => {
    if (!item.sellFor || item.sellFor.length === 0) return 0;
    const maxPrice = Math.max(...item.sellFor.map((s) => s.price));
    return Math.floor(maxPrice / (item.width * item.height));
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', background: '#111827', color: 'white', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Tarkov Loot Checker</h1>
      </header>

      <input
        type="text"
        placeholder="🔍 アイテム名を検索..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '8px', marginBottom: '16px', background: '#1f2937', border: '1px solid #374151', color: 'white', borderRadius: '4px', boxSizing: 'border-box' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {filteredItems.slice(0, 12).map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <img src={item.iconLink} alt={item.shortName} style={{ width: '40px', height: '40px', objectFit: 'contain', marginBottom: '4px' }} />
            <span style={{ fontSize: '10px', marginBottom: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{item.name}</span>
            <span style={{ fontSize: '10px', color: '#facc15', fontWeight: 'bold' }}>
              {item.sellFor[0]?.price ? `${item.sellFor[0].price.toLocaleString()} ₽` : '---'}
            </span>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#1f2937', width: '100%', maxWidth: '400px', padding: '24px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', boxSizing: 'border-box' }}>
            <button onClick={() => setSelectedItem(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' }}>✖️</button>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{selectedItem.name}</h2>
            <p style={{ color: '#facc15', fontSize: '14px', marginBottom: '8px' }}>1マス価値: {getSlotValue(selectedItem).toLocaleString()} ₽ / slot</p>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>必要タスク数: {selectedItem.usedInTasks?.length || 0}件</p>
          </div>
        </div>
      )}
    </div>
  );
}
