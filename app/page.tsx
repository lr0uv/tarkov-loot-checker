'use client';
import { useState, useEffect } from 'react';
import { fetchTarkovItems, TarkovItem } from './api';

export default function LootChecker() {
  const [items, setItems] = useState<TarkovItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TarkovItem | null>(null);
  const [lang, setLang] = useState<'ja' | 'en'>('ja');

  useEffect(() => {
    const userLang = navigator.language || (navigator as any).userLanguage;
    setLang(userLang && userLang.toLowerCase().startsWith('en') ? 'en' : 'ja');
  }, []);

  useEffect(() => {
    fetchTarkovItems(lang).then((data) => setItems(data));
  }, [lang]);

  const getSlotValue = (item: TarkovItem) => {
    if (!item.sellFor || item.sellFor.length === 0) return 0;
    const maxPrice = Math.max(...item.sellFor.map((s) => s.price));
    return Math.floor(maxPrice / ((item.width || 1) * (item.height || 1)));
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.shortName && item.shortName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
      color: '#f8fafc',
      padding: '16px',
      fontFamily: 'sans-serif',
      display: 'flex',
      justifyContent: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 'bold' }}>⚡ Tarkov Loot Checker</h1>
          <select value={lang} onChange={(e) => setLang(e.target.value as 'ja' | 'en')} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '6px 12px', color: '#f8fafc', cursor: 'pointer' }}>
            <option value="ja" style={{ background: '#1e1b4b' }}>🇯🇵 日本語</option>
            <option value="en" style={{ background: '#1e1b4b' }}>🇺🇸 English</option>
          </select>
        </header>

        <input type="text" placeholder={lang === 'en' ? "🔍 Search..." : "🔍 検索..."} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 16px', marginBottom: '20px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', color: '#f8fafc', outline: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {filteredItems.slice(0, 24).map((item) => (
            <div key={item.id} onClick={() => setSelectedItem(item)} style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.iconLink ? <img src={item.iconLink} style={{ width: '32px', height: '32px', objectFit: 'contain' }} /> : 'IMG'}
              </div>
              <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>{item.name}</span>
            </div>
          ))}
        </div>

        {selectedItem && (
          <div onClick={() => setSelectedItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', background: 'rgba(30,27,75,0.85)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(255,255,255,0.2)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', margin: '0 0 12px 0' }}>{selectedItem.name}</h2>
              <p style={{ color: '#38bdf8', fontSize: '14px' }}>1マス価値: {getSlotValue(selectedItem).toLocaleString()} ₽</p>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '8px 16px', color: '#f8fafc', cursor: 'pointer' }}>閉じる</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
