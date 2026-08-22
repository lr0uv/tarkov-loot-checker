import LootCheckerClient from './LootCheckerClient';

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
  types: string[] | null;
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

    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 } 
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const json = await response.json();

    if (json.data && json.data.items) {
      const rawItems: Item[] = json.data.items;
      
      processedItems = rawItems.map(item => {
        // Null対策を徹底
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
          // APIから名前が来なかった場合は 'Unknown Item' を入れる
          name: item.name || 'Unknown Item',
          shortName: item.shortName || item.name || 'Unknown',
          slots,
          iconLink: item.iconLink || 'https://via.placeholder.com/50',
          types: item.types || [],
          fleaPrice,
          traderPrice,
          traderName,
          bestPrice,
          valuePerSlot
        };
      }).filter(item => item.bestPrice > 0); // 価値が0のアイテム（売れないもの）だけ弾く

      // 1マス価値が高い順にソート
      processedItems.sort((a, b) => b.valuePerSlot - a.valuePerSlot);
    }
  } catch (error) {
    console.error("サーバーでのデータ取得に失敗しました:", error);
  }

  // クライアントコンポーネントへ確実にデータを渡す
  return <LootCheckerClient initialItems={processedItems} />;
}
