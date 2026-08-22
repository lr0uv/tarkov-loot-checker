"use client";

import React, { useState, useEffect, useMemo } from 'react';

type ProcessedItem = {
  id: string;
  name: string;
  enName: string;
  shortName: string;
  slots: number;
  types: string[];
  fleaPrice: number;
  traderPrice: number;
  traderName: string;
  bestPrice: number;
  valuePerSlot: number;
};

type Lang = 'ja' | 'en';

const uiDict = {
  ja: { searchPlaceholder: "アイテム名で検索 (例: LedX, 砂糖...)", loading: "市場データを読み込み中...", slot: "マス", valuePerSlot: "1マス価値", flea: "フリマ" },
  en: { searchPlaceholder: "Search items (e.g. LedX, Sugar...)", loading: "Loading market data...", slot: " slots", valuePerSlot: "Value / Slot", flea: "Flea" }
};

const CATEGORIES = [
  { id: 'all', icon: '🔍', label: { ja: 'すべて', en: 'All' }, types: [] },
  { id: 'medical', icon: '🏥', label: { ja: '医療品', en: 'Medical' }, types: ['medical', 'meds', 'injectors'] },
  { id: 'food', icon: '🍔', label: { ja: '食料品', en: 'Food' }, types: ['provisions'] },
  { id: 'building', icon: '🧱', label: { ja: '建築資材', en: 'Building' }, types: ['barter'] },
  { id: 'valuables', icon: '💎', label: { ja: '貴重品', en: 'Valuables' }, types: ['barter'] },
];

export default function Home() {
  const [items, setItems] = useState<ProcessedItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('ja');
  const [isLangLoaded, setIsLangLoaded] = useState(false);

  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (!browserLang.startsWith('ja')) setLang('en');
    setIsLangLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLangLoaded) return;

    const fetchLocalData = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      try {
        // ★API通信をやめ、GitHub Actionsが作ったローカルのJSONを読み込むだけ！
        const response = await fetch('/items.json');
        
        if (!response.ok) {
           throw new Error("データファイルの読み込みに失敗しました。初回のデータ自動生成待ちの可能性があります。数分後にリロードしてください。");
        }

        const data = await response.json();
        setItems(data);
      } catch (error: any) {
        console.error("Local fetch error:", error);
        setErrorMsg(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLocalData();
  }, [lang, isLangLoaded]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeCategory !== 'all') {
      const targetTypes = CATEGORIES.find(c => c.id === activeCategory)?.types || [];
      result = result.filter(item => item.types?.some(type => targetTypes.includes(type)));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.enName.toLowerCase().includes(q) ||
        item.shortName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, search, activeCategory]);

  const t = uiDict[lang];

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 20px 40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '0.9rem', color: '#888', marginRight: '10px' }}>言語:</span>
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} style={{ padding: '5px 10px', backgroundColor: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}>
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>

      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#E2B02B', fontSize: '1.8rem', margin: '0 0 15px 0' }}>Tarkov Loot Checker</h1>
        <input type="text" placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 15px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1E1E1E', color: '#fff', outline: 'none' }} />
      </header>

      <section style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{ padding: '8px 15px', whiteSpace: 'nowrap', backgroundColor: activeCategory === c.id ? '#E2B02B' : '#222', color: activeCategory === c.id ? '#000' : '#fff', border: `1px solid ${activeCategory === c.id ? '#E2B02B' : '#444'}`, borderRadius: '8px', cursor: 'pointer', fontWeight: activeCategory === c.id ? 'bold' : 'normal' }}>
              {c.icon} {c.label[lang]}
            </button>
          ))}
        </div>
      </section>

      {errorMsg ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#ff4444' }}>{errorMsg}</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>{t.loading}</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>見つかりませんでした。</div>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
          {filteredItems.slice(0, 100).map(item => ( 
            <article key={item.id} style={{ backgroundColor: '#1E1E1E', border: '1px solid #333', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '10px' }}>
                <h2 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#fff' }}>
                  {lang === 'ja' ? item.name : item.enName} 
                  {lang === 'ja' && <span style={{ color: '#888', fontSize: '0.85rem' }}> ({item.enName})</span>}
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#aaa', backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>{item.slots}{t.slot}</span>
              </div>
              <div style={{ backgroundColor: '#2A2A2A', padding: '10px', borderRadius: '6px', textAlign: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#aaa', display: 'block' }}>【{t.valuePerSlot}】</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#E2B02B' }}>₽{item.valuePerSlot.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '0.9rem', borderTop: '1px dashed #444', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: '#888' }}>- {t.flea}:</span><span style={{ color: '#4CAF50' }}>₽{item.fleaPrice.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>- {item.traderName}:</span><span style={{ color: '#fff' }}>₽{item.traderPrice.toLocaleString()}</span></div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
