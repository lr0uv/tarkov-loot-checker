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
  name: string;
  shortName: string;
  width: number;
  height: number;
  iconLink: string;
  sellFor: SellFor[];
};

type ProcessedItem = {
  id: string;
  name: string;
  shortName: string;
  slots: number;
  iconLink: string;
  fleaPrice: number;
  traderPrice: number;
  traderName: string;
  bestPrice: number;
  valuePerSlot: number;
};

// UIテキストの多言語辞書
const uiDict = {
  ja: {
    title: "Tarkov Loot Checker",
    desc: "アイテムの価値・フリマ価格・トレーダー価格を比較して、最高効率のレイドを目指そう。",
    searchPlaceholder: "アイテム名で検索 (例: LedX, 砂糖...)",
    loading: "データを読み込み中... (API Fetching)",
    slot: "マス",
    valuePerSlot: "1マス価値",
    flea: "フリマ",
    footer: "※データは tarkov.dev API を使用しています。パフォーマンス維持のため上位100件を表示。"
  },
  en: {
    title: "Tarkov Loot Checker",
    desc: "Compare item values, flea market, and trader prices for maximum raid efficiency.",
    searchPlaceholder: "Search items (e.g. LedX, Sugar...)",
    loading: "Loading data... (API Fetching)",
    slot: " slots",
    valuePerSlot: "Value / Slot",
    flea: "Flea",
    footer: "*Data provided by tarkov.dev API. Showing top 100 items for performance."
  }
};

type Lang = 'ja' | 'en';

export default function Home() {
  const [items, setItems] = useState<ProcessedItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('en'); // 初期値は英語
  const [isLangLoaded, setIsLangLoaded] = useState(false);

  // 1. 初回アクセス時にブラウザの言語を自動判定
  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ja')) {
      setLang('ja');
    }
    setIsLangLoaded(true);
  }, []);

  // 2. 言語が決定、または手動で変更されたらAPIからその言語のデータを取得
  useEffect(() => {
    if (!isLangLoaded) return;

    const fetchItems = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://api.tarkov.dev/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            query: `
              {
                items(lang: ${lang}) {
                  id
                  name
                  shortName
                  width
                  height
                  iconLink
                  sellFor {
                    priceRUB
                    vendor {
                      name
                      normalizedName
                    }
                  }
                }
              }
            `
          })
        });

        const json = await response.json();
        if (json.data && json.data.items) {
          const rawItems: Item[] = json.data.items;
          
          const processed = rawItems.map(item => {
            const slots = item.width * item.height;
            let fleaPrice = 0;
            let traderPrice = 0;
            let traderName = '-';

            item.sellFor.forEach(sell => {
              if (sell.vendor.normalizedName === 'flea-market') {
                fleaPrice = sell.priceRUB;
              } else {
                if (sell.priceRUB > traderPrice) {
                  traderPrice = sell.priceRUB;
                  traderName = sell.vendor.name;
                }
              }
            });

            const bestPrice = Math.max(fleaPrice, traderPrice);
            const valuePerSlot = slots > 0 ? Math.floor(bestPrice / slots) : 0;

            return {
              id: item.id,
              name: item.name,
              shortName: item.shortName,
              slots,
              iconLink: item.iconLink,
              fleaPrice,
              traderPrice,
              traderName,
              bestPrice,
              valuePerSlot
            };
          }).filter(item => item.bestPrice > 0); 

          setItems(processed.sort((a, b) => b.valuePerSlot - a.valuePerSlot));
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [lang, isLangLoaded]);

  // 検索フィルター
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      item.shortName.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const t = uiDict[lang];

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* 言語切り替えスイッチ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as Lang)}
          style={{
            padding: '5px 10px',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          <option value="en">English</option>
          <option value="ja">日本語</option>
        </select>
      </div>

      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#E2B02B', fontSize: '2rem', margin: '0 0 10px 0' }}>{t.title}</h1>
        <p style={{ color: '#A0A0A0', fontSize: '0.9rem', margin: 0 }}>{t.desc}</p>
      </header>

      <section style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder={t.searchPlaceholder} 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '1rem',
            borderRadius: '8px',
            border: '1px solid #444',
            backgroundColor: '#222',
            color: '#fff',
            outline: 'none',
          }}
        />
      </section>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
          {t.loading}
        </div>
      ) : (
        <section style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '20px' 
        }}>
          {filteredItems.slice(0, 100).map(item => ( 
            <article key={item.id} style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '15px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src={item.iconLink} alt={item.name} loading="lazy" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
                <div>
                  <h2 style={{ fontSize: '1.1rem', margin: '0 0 5px 0', color: '#fff' }}>{item.shortName}</h2>
                  <span style={{ fontSize: '0.8rem', color: '#888', backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>
                    {item.slots}{t.slot}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{t.valuePerSlot}</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#E2B02B' }}>
                    ₽{item.valuePerSlot.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.9rem' }}>
                  <span style={{ color: item.fleaPrice >= item.traderPrice ? '#4CAF50' : '#888' }}>
                    {t.flea}: ₽{item.fleaPrice.toLocaleString()}
                  </span>
                  <span style={{ color: item.traderPrice > item.fleaPrice ? '#4CAF50' : '#888' }}>
                    {item.traderName}: ₽{item.traderPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      <footer style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '0.8rem' }}>
        {t.footer}
      </footer>
    </main>
  );
}
