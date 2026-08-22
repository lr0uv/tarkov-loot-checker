import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Cloudflare対策としてUser-Agentを偽装
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Tarkov API HTTP Error:", response.status, errText);
      return NextResponse.json({ error: `HTTP ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("Proxy API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
