import LootCheckerClient from './LootCheckerClient';

// 魔法の1行: ここで「5分(300秒)に1回だけデータを取得・キャッシュする」ようVercelに指示します
export const revalidate = 300;

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

export default async function Home() {
  let processedItems = [];

  try {
    const query = `
      {
        items(lang: ja) {
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

    // サーバーサイドでAPIを取得（クライアント側のエラーはここで消滅します）
    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query: query }),
      next: { revalidate: 300 } 
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const json = await response.json();

    if (json.data && json.data.items) {
      const rawItems: Item[] = json.data.items;
      
      // 1マス価値の計算などをすべてサーバー側で完了させておく
      processedItems = rawItems.map(item => {
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

        return {
          id: item.id || Math.random().toString(),
          name: item.name || '',
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

      // 1マス価値が高い順にソート
      processedItems.sort((a, b) => b.valuePerSlot - a.valuePerSlot);
    }
  } catch (error) {
    console.error("サーバーでのデータ取得に失敗しました:", error);
    // 取得に失敗した場合でもサイトはクラッシュせず、前回成功時のキャッシュが表示され続けます
  }

  // サーバー側で計算したデータをクライアント(画面)に渡す
  return <LootCheckerClient initialItems={processedItems} />;
}
