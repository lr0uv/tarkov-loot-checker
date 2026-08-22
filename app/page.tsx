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
  let processedItems: any[] = [];
  let serverErrorMessage = null;

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
        // ボット（Vercel）と判定されてCloudflareに弾かれるのを防ぐための偽装ヘッダーを追加
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 } 
    });

    if (!response.ok) {
      // エラー時にCloudflare等のHTMLが返ってくることを考慮し、最初の100文字だけ取得
      const errText = await response.text();
      throw new Error(`HTTPエラー ${response.status}: ${errText.substring(0, 100)}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(`GraphQLエラー: ${json.errors[0].message}`);
    }

    if (json.data && json.data.items) {
      const rawItems: Item[] = json.data.items;
      
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
      }).filter(item => item.bestPrice > 0);

      processedItems.sort((a, b) => b.valuePerSlot - a.valuePerSlot);
    } else {
      throw new Error("APIからitemsデータが返却されませんでした。");
    }
  } catch (error: any) {
    console.error("サーバーでのデータ取得に失敗しました:", error);
    serverErrorMessage = error.message;
  }

  return (
    <>
      {/* サーバー側でエラーが起きた場合のみ、原因を画面上部に赤く表示します */}
      {serverErrorMessage && (
        <div style={{ backgroundColor: '#ff4444', color: 'white', padding: '15px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
          【デバッグ用エラーログ】API通信に失敗しました。<br/>
          詳細: {serverErrorMessage}
        </div>
      )}
      <LootCheckerClient initialItems={processedItems} />
    </>
  );
}
