"use client";

import React, { useState, useEffect, useMemo } from 'react';

type ProcessedItem = {
  id: string;
  name: string;
  shortName: string;
  slots: number;
  iconLink: string;
  types: string[];
  fleaPrice: number;
  traderPrice: number;
  traderName: string;
  bestPrice: number;
  valuePerSlot: number;
};

type Lang = 'ja' | 'en';

const uiDict = {
  ja: {
    searchPlaceholder: "アイテム名で検索 (例: LedX, 砂糖...)",
    slot: "マス",
    valuePerSlot: "1マス価値",
    flea: "フリマ",
  },
  en: {
    searchPlaceholder: "Search items (e.g. LedX, Sugar...)",
    slot: " slots",
    valuePerSlot: "Value / Slot",
    flea: "Flea",
  }
};

const CATEGORIES = [
  { id: 'all', icon: '🔍', label: { ja: 'すべて', en: 'All' }, types: [] },
  { id: 'medical', icon: '🏥', label: { ja: '医療品', en: 'Medical' }, types: ['medical', 'meds', 'injectors'] },
  { id: 'food', icon: '🍔', label: { ja: '食料品', en: 'Food' }, types: ['provisions'] },
  { id: 'building', icon: '🧱', label: { ja: '建築資材', en: 'Building' }, types: ['barter'] },
  { id: 'valuables', icon: '💎', label: { ja: '貴重品', en: 'Valuables' }, types: ['barter'] },
];

export default function LootCheckerClient({ initialItems }: { initialItems: ProcessedItem[] }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [lang, setLang] = useState<Lang>('ja');

  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (!browserLang.startsWith('ja')) {
      setLang('en');
    }
  }, []);

  const filteredItems = useMemo(() => {
    let result = initialItems;

    if (activeCategory !== 'all') {
      const targetTypes = CATEGORIES.find(c => c.id === activeCategory)?.types || [];
      result = result.filter(item => 
        item.types.some(type => targetTypes.includes(type))
      );
    }

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(item => {
        return (item.name && item.name.toLowerCase().includes(query)) || 
               (item.shortName && item.shortName.toLowerCase().includes(query));
      });
    }

    return result;
  }, [initialItems, search, activeCategory]);

  const t = uiDict[lang];

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 20px 40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '0.9rem', color: '#888', marginRight: '10px' }}>言語:</span>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as Lang)}
          style={{
            padding: '5px 10px',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>

      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#E2B02B', fontSize: '1.8rem', margin: '0 0 15px 0' }}>Tarkov Loot Checker</h1>
        <input 
          type="text" 
          placeholder={t.searchPlaceholder} 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 15px',
            fontSize: '1rem',
            borderRadius: '8px',
            border: '1px solid #444',
            backgroundColor: '#1E1E1E',
            color: '#fff',
            outline: 'none',
          }}
        />
      </header>

      <section style={{ marginBottom: '30px' }}>
        <div style={{
          display: 'grid',
          gridTemplateRows: 'repeat(2, 1fr)',
          gridAutoFlow: 'column',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '10px',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 20px',
                whiteSpace: 'nowrap',
                backgroundColor: activeCategory === category.id ? '#E2B02B' : '#222',
                color: activeCategory === category.id ? '#000' : '#fff',
                border: `1px solid ${activeCategory === category.id ? '#E2B02B' : '#444'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: activeCategory === category.id ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              <span>{category.icon}</span>
              <span>{category.label[lang]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 初期ロードやエラー文字は消滅。常にデータが即座に表示されます */}
      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>一致するアイテムが見つかりませんでした。</div>
      ) : (
        <section style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '15px' 
        }}>
          {filteredItems.slice(0, 100).map(item => ( 
            <article key={item.id} style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '15px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ width: '60px', height: '60px', flexShrink: 0, backgroundColor: '#111', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.iconLink && <img src={item.iconLink} alt={item.name} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h2 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {item.name} {lang === 'ja' && item.shortName && item.shortName !== item.name && <span style={{ color: '#888', fontSize: '0.85rem' }}>({item.shortName})</span>}
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#aaa', backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>
                    {item.slots}{t.slot}
                  </span>
                </div>
              </div>
              
              <div style={{ backgroundColor: '#2A2A2A', padding: '10px', borderRadius: '6px', textAlign: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>【{t.valuePerSlot}】</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#E2B02B' }}>
                  ₽{item.valuePerSlot.toLocaleString()}
                </span>
              </div>

              <div style={{ fontSize: '0.9rem', borderTop: '1px dashed #444', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#888' }}>- {t.flea}:</span>
                  <span style={{ color: item.fleaPrice >= item.traderPrice ? '#4CAF50' : '#fff' }}>₽{item.fleaPrice.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>- {item.traderName}:</span>
                  <span style={{ color: item.traderPrice > item.fleaPrice ? '#4CAF50' : '#fff' }}>₽{item.traderPrice.toLocaleString()}</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
