"use client";

import React, { useState, useEffect, useMemo } from 'react';

// データ型の定義
type SellFor = {
  priceRUB: number;
  vendor: {
    name: string;
    normalizedName: string;
  };
};

type Item = {
  id: string;
  name: string | null;
  shortName: string | null;
  width: number | null;
  height: number | null;
  iconLink: string | null;
  types: string[];
  sellFor: SellFor[] | null;
};

type ProcessedItem = {
  id: string;
  name: string;
  enName: string;
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

// UIテキストの多言語辞書
const uiDict = {
  ja: {
    searchPlaceholder: "アイテム名で検索 (例: LedX, 砂糖...)",
    loading: "データを読み込み中... (API Fetching)",
    slot: "マス",
    valuePerSlot: "1マス価値",
    flea: "フリマ",
  },
  en: {
    searchPlaceholder: "Search items (e.g. LedX, Sugar...)",
    loading: "Loading data... (API Fetching)",
    slot: " slots",
    valuePerSlot: "Value / Slot",
    flea: "Flea",
  }
};

// カテゴリの定義とAPIのtypesマッピング
const CATEGORIES = [
  { id: 'all', icon: '🔍', label: { ja: 'すべて', en: 'All' }, types: [] },
  { id: 'medical', icon: '🏥', label: { ja: '医療品', en: 'Medical' }, types: ['medical', 'meds', 'injectors'] },
  { id: 'food', icon: '🍔', label: { ja: '食料品', en: 'Food' }, types: ['provisions'] },
  { id: 'building', icon: '🧱', label: { ja: '建築資材', en: 'Building' }, types: ['barter'] },
  { id: 'weapon', icon: '🔫', label: { ja: '武器類', en: 'Weapons' }, types: ['gun', 'grenade'] },
  { id: 'armor', icon: '👕', label: { ja: '防具類', en: 'Armor' }, types: ['armor', 'helmet', 'wearable'] },
  { id: 'keys', icon: '🗝️', label: { ja: '鍵類', en: 'Keys' }, types: ['keys'] },
  { id: 'valuables', icon: '💎', label: { ja: '貴重品', en: 'Valuables' }, types: ['barter'] },
  { id: 'container', icon: '🎒', label: { ja: 'コンテナ', en: 'Containers' }, types: ['backpack', 'rig'] },
];

export default function Home() {
  const [items, setItems] = useState<ProcessedItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('ja');
  const [isLangLoaded, setIsLangLoaded] = useState(false);

  // ブラウザ言語の初期判定
  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (!browserLang.startsWith('ja')) {
      setLang('en');
    }
    setIsLangLoaded(true);
  }, []);

  // データ取得
  useEffect(() => {
    if (!isLangLoaded) return;

    const fetchItems = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      try {
        // 英語データと、現在選択中の言語データを別々のエイリアスで取得するクエリ
        const query = `
          {
            itemsEn: items(lang: en) {
              id
              name
            }
            itemsCurrent: items(lang: ${lang}) {
              id
              name
              shortName
              width
              height
              iconLink
              types
              sellFor {
                priceRUB
                vendor {
                  name
                  normalizedName
                }
              }
            }
          }
        `;

        const response = await fetch('https://api.tarkov.dev/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
           throw new Error(`HTTP Error: ${response.status}`);
        }

        const json = await response.json();

        if (json.errors) {
          console.error("GraphQL Errors:", json.errors);
          throw new Error(json.errors[0].message);
        }

        if (json.data && json.data.itemsCurrent && json.data.itemsEn) {
          // 英語名の辞書を作成
          const enNameMap = new Map();
          json.data.itemsEn.forEach((item: { id: string, name: string }) => {
            enNameMap.set(item.id, item.name);
          });

          const rawItems: Item[] = json.data.itemsCurrent;
          
          const processed = rawItems.map(item => {
            const slots = (item.width || 1) * (item.height || 1);
            let fleaPrice = 0;
            let traderPrice = 0;
            let traderName = '-';

            if (item.sellFor && Array.isArray(item.sellFor)) {
              item.sellFor.forEach(sell => {
                if (!sell.vendor) return;
                if (sell.vendor.normalizedName === 'flea-market') {
                  fleaPrice = sell.priceRUB || 0;
                } else {
                  if ((sell.priceRUB || 0) > traderPrice) {
                    traderPrice = sell.priceRUB;
                    traderName = sell.vendor.name || '-';
                  }
                }
              });
            }

            const bestPrice = Math.max(fleaPrice, traderPrice);
            const valuePerSlot = slots > 0 ? Math.floor(bestPrice / slots) : 0;
            const enName = enNameMap.get(item.id) || item.name || '';

            return {
              id: item.id || Math.random().toString(),
              name: item.name || '',
              enName: enName,
              shortName: item.shortName || '',
              slots,
              iconLink: item.iconLink || '',
              types: item.types || [],
              fleaPrice,
              traderPrice,
              traderName,
              bestPrice,
              valuePerSlot
            };
          }).filter(item => item.bestPrice > 0); 

          setItems(processed.sort((a, b) => b.valuePerSlot - a.valuePerSlot));
        } else {
           throw new Error("No data returned from API");
        }
      } catch (error: any) {
        console.error("Fetch error:", error);
        setErrorMsg(`APIデータの取得に失敗しました。詳細: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [lang, isLangLoaded]);

  // 検索とカテゴリのクロスフィルター
  const filteredItems = useMemo(() => {
    let result = items;

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
               (item.enName && item.enName.toLowerCase().includes(query)) || 
               (item.shortName && item.shortName.toLowerCase().includes(query));
      });
    }

    return result;
  }, [items, search, activeCategory]);

  const t = uiDict[lang];

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 20px 40px 20px' }}>
      
      {/* 1. 最上部: 言語設定のみ */}
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
        {/* 2. 検索バー */}
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

      {/* 3. カテゴリ選択 */}
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

      {/* 4. アイテムリスト */}
      {errorMsg ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#ff4444' }}>{errorMsg}</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>{t.loading}</div>
      ) : filteredItems.length === 0 ? (
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
                    {item.name} {lang === 'ja' && item.enName !== item.name && <span style={{ color: '#888', fontSize: '0.85rem' }}>({item.enName})</span>}
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
