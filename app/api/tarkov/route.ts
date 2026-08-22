import { NextResponse } from 'next/server';

// 魔法の1行: Vercelの通常サーバーではなく、Cloudflareと同じ「Edgeネットワーク」から通信させる
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // 偽装は逆効果になるため削除し、専用ツールとして正直に名乗ります
        'User-Agent': 'TarkovLootChecker/1.0 (Edge Proxy)',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Tarkov API HTTP Error:", response.status, errText);
      return NextResponse.json({ error: `HTTP ${response.status} - Cloudflare Blocked` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("Proxy API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
