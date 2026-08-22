"use client";

import React, { useState, useEffect, useMemo } from 'react';

type BarterUsage = {
  type: 'barter' | 'hideout';
  targetName: string;
  enTargetName: string;
  traderName?: string;
  requiredCount: number;
};

type StaticItem = {
  id: string;
  name: string;
  enName: string;
  shortName: string;
  category: string;
  enCategory: string;
  slots: number;
  traderPrice: number;
  traderName: string;
  imageLink: string;
  usages: BarterUsage[];
};

type Lang = 'ja' | 'en';

const uiDict = {
  ja: {
    searchPlaceholder: "アイテム名で検索 (例: テーピング、グラボ、LedX...)",
    allCategories: "すべて",
    loading: "データベースを読み込み中...",
    slot: "マス",
    traderPrice: "店売り買取",
    noUsage: "現在登録されている交換・隠れ信用途はありません",
    usageBarter: "【交換 (Barter)】",
    usageHideout: "【隠れ家 (Hideout)】",
    usageTitle: "用途・交換先",
    required: "必要数",
    notFound: "一致するアイテムが見つかりませんでした。"
  },
  en: {
    searchPlaceholder: "Search items (e.g. Tape, GPU, LedX...)",
    allCategories: "All",
    loading: "Loading database...",
    slot: " slots",
    traderPrice: "Trader Buy",
    noUsage: "No barter or hideout usage registered",
    usageBarter: "[Barter]",
    usageHideout: "[Hideout]",
    usageTitle: "Usages & Barters",
    required: "Required",
    notFound: "No items found."
  }
};

export default function Home() {
  const [items, setItems] = useState<StaticItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('ja');

  useEffect(() => {
    const loadLocalData = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      try {
        const response = await fetch('/items.json');
        if (!response.ok) {
           throw new Error("アイテムデータの読み込みに失敗しました。public/items.json が配置されているか確認してください。");
        }
        const data = await response.json();
        setItems(data);
      } catch (error: any) {
        console.error("Data load error:", error);
        setErrorMsg(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadLocalData();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      set.add(lang === 'ja' ? item.category : item.enCategory);
    });
    return Array.from(set);
  }, [items, lang]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const itemCat = lang === 'ja' ? item.category : item.enCategory;
      const matchesCategory = selectedCategory === 'all' || itemCat === selectedCategory;
      
      if (!search) return matchesCategory;
      const q = search.toLowerCase();
      const matchesSearch = 
        item.name.toLowerCase().includes(q) || 
        item.enName.toLowerCase().includes(q) ||
        item.shortName.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [items, search, selectedCategory, lang]);

  const t = uiDict[lang];

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#E2B02B', fontSize: '1.6rem', margin: 0 }}>Tarkov Barter & Loot Checker</h1>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as Lang)} 
          style={{ padding: '8px 12px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', zIndex: 10, position: 'relative' }}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input 
          type="text" 
          placeholder={t.searchPlaceholder} 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          style={{ width: '100%', padding: '14px 18px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1E1E1E', color: '#fff', outline: 'none' }} 
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid #444',
            backgroundColor: selectedCategory === 'all' ? '#E2B02B' : '#1E1E1E',
            color: selectedCategory === 'all' ? '#000' : '#fff',
            cursor: 'pointer',
            fontWeight: selectedCategory === 'all' ? 'bold' : 'normal'
          }}
        >
          {t.allCategories}
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #444',
              backgroundColor: selectedCategory === cat ? '#E2B02B' : '#1E1E1E',
              color: selectedCategory === cat ? '#000' : '#fff',
              cursor: 'pointer',
              fontWeight: selectedCategory === cat ? 'bold' : 'normal'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {errorMsg ? (
        <div style={{ backgroundColor: '#2a1a1a', border: '1px solid #ff4444', padding: '20px', borderRadius: '8px', color: '#ff4444', textAlign: 'center' }}>
          {errorMsg}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>{t.loading}</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>{t.notFound}</div>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {filteredItems.map(item => {
            const itemCat = lang === 'ja' ? item.category : item.enCategory;
            return (
              <article key={item.id} style={{ backgroundColor: '#1E1E1E', border: '1px solid #333', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {item.imageLink && (
                      <img src={item.imageLink} alt={item.name} style={{ width: '50px', height: '50px', objectFit: 'contain', backgroundColor: '#111', borderRadius: '4px', padding: '4px', border: '1px solid #333' }} />
                    )}
                    <div>
                      <h2 style={{ fontSize: '1.2rem', margin: '0 0 4px 0', color: '#fff' }}>
                        {lang === 'ja' ? item.name : item.enName} 
                        <span style={{ color: '#888', fontSize: '0.9rem', fontWeight: 'normal', marginLeft: '8px' }}>({item.enName})</span>
                      </h2>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#aaa', backgroundColor: '#2A2A2A', padding: '2px 8px', borderRadius: '4px' }}>
                          {item.slots} {t.slot}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#4DB6AC', backgroundColor: '#1A2F2C', padding: '2px 8px', borderRadius: '4px' }}>
                          {itemCat}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', display: 'block' }}>{t.traderPrice} ({item.traderName})</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4CAF50' }}>₽{item.traderPrice.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#E2B02B', margin: '0 0 8px 0' }}>{t.usageTitle}</h3>
                  {item.usages && item.usages.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {item.usages.map((usage, idx) => {
                        const targetName = lang === 'ja' ? usage.targetName : usage.enTargetName;
                        return (
                          <li key={idx} style={{ fontSize: '0.9rem', color: '#ddd' }}>
                            {usage.type === 'barter' ? (
                              <span>
                                <strong style={{ color: '#64B5F6' }}>{t.usageBarter}</strong> [{usage.traderName}] 
                                <span style={{ color: '#fff', fontWeight: 'bold' }}> {targetName}</span> ({t.required}: {usage.requiredCount})
                              </span>
                            ) : (
                              <span>
                                <strong style={{ color: '#BA68C8' }}>{t.usageHideout}</strong> 
                                <span style={{ color: '#fff', fontWeight: 'bold' }}> {targetName}</span> ({t.required}: {usage.requiredCount})
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>{t.noUsage}</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
