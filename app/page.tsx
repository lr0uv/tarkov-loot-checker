"use client";

import React, { useState, useEffect, useMemo } from 'react';

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
  sellFor: SellFor[] | null;
};

type ProcessedItem = {
  id: string;
  name: string;
  shortName: string;
  slots: number;
  fleaPrice: number;
  traderPrice: number;
  traderName: string;
  bestPrice: number;
  valuePerSlot: number;
};

type Lang = 'ja' | 'en';

const uiDict = {
  ja: { searchPlaceholder: "アイテム名で検索 (例: LedX, 砂糖...)", loading: "データを読み込み中...", slot: "マス", valuePerSlot: "1マス価値", flea: "フリマ" },
  en: { searchPlaceholder: "Search items (e.g. LedX, Sugar...)", loading: "Loading data...", slot: " slots", valuePerSlot: "Value / Slot", flea: "Flea" }
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

    const fetchItems = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      try {
        const query = `
          {
            items(lang: ${lang}) {
              id
              name
              shortName
              width
              height
              types
              sellFor {
                priceRUB
                vendor { name normalizedName }
              }
            }
          }
        `;

        // ★魔法の1行: corsproxyを経由してCORS制限を強行突破する
        const response = await fetch('https://corsproxy.io/?https://api.tarkov.dev/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });

        if (!response.ok) {
           const errText = await response.text();
           throw new Error(`HTTP ${response.status} - ${errText.substring(0, 100)}`);
        }

        const json = await response.json();
        if (json.errors) throw new Error(json.errors[0].message);

        if (json.data && json.data.items) {
          const processed = json.data.items.map((item: any) => {
            const slots = (item.width || 1) * (item.height || 1);
            let fleaPrice = 0, traderPrice = 0, traderName = '-';

            if (item.sellFor) {
              item.sellFor.forEach((sell: any) => {
                if (!sell.vendor) return;
                if (sell.vendor.normalizedName === 'flea-market') {
                  fleaPrice = sell.priceRUB || 0;
                } else if ((sell.priceRUB || 0) > traderPrice) {
                  traderPrice = sell.priceRUB;
                  traderName = sell.vendor.name || '-';
                }
              });
            }

            const bestPrice = Math.max(fleaPrice, traderPrice);
            return {
              id: item.id || Math.random().toString(),
              name: item.name || 'Unknown',
              shortName: item.shortName || 'Unknown',
              slots,
              types: item.types || [],
              fleaPrice, traderPrice, traderName, bestPrice,
              valuePerSlot: slots > 0 ? Math.floor(bestPrice / slots) : 0
            };
          }).filter((item: any) => item.bestPrice > 0); 

          setItems(processed.sort((a: any, b: any) => b.valuePerSlot - a.valuePerSlot));
        }
      } catch (error: any) {
        console.error("Fetch error:", error);
        setErrorMsg(`通信エラー: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [lang, isLangLoaded]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeCategory !== 'all') {
      const targetTypes = CATEGORIES.find(c => c.id === activeCategory)?.types || [];
      result = result.filter(item => item.types?.some(type => targetTypes.includes(type)));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(q) || item.shortName.toLowerCase().includes(q));
    }
    return result;
  }, [items, search, activeCategory]);

  const t = uiDict[lang];

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 20px 40px 20px' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#E2B02B', fontSize: '1.8rem', margin: '0 0 15px 0' }}>Tarkov Loot Checker</h1>
        <input 
          type="text" placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 15px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1E1E1E', color: '#fff' }}
        />
      </header>

      <section style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)}
              style={{ padding: '8px 15px', whiteSpace: 'nowrap', backgroundColor: activeCategory === c.id ? '#E2B02B' : '#222', color: activeCategory === c.id ? '#000' : '#fff', border: `1px solid ${activeCategory === c.id ? '#E2B02B' : '#444'}`, borderRadius: '8px', cursor: 'pointer', fontWeight: activeCategory === c.id ? 'bold' : 'normal' }}>
              {c.icon} {c.label[lang]}
            </button>
          ))}
        </div>
      </section>

      {errorMsg ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#ff4444' }}>{errorMsg}<br/><br/>※アプローチB（根本解決）へ移行する場合はお知らせください。</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>{t.loading}</div>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
          {filteredItems.slice(0, 100).map(item => ( 
            <article key={item.id} style={{ backgroundColor: '#1E1E1E', border: '1px solid #333', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '10px' }}>
                <h2 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#fff' }}>{item.name} <span style={{ color: '#888', fontSize: '0.85rem' }}>({item.shortName})</span></h2>
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
