export type TarkovItem = {
  id: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  iconLink: string;
  sellFor: { price: number; currency: string }[];
  categories: { name: string }[];
  usedInTasks: { name: string }[];
};

export async function fetchTarkovItems(lang: string = 'ja'): Promise<TarkovItem[]> {
  const query = `
    query GetItems($lang: LanguageCode!) {
      items(lang: $lang) {
        id
        name
        shortName
        width
        height
        iconLink
        sellFor { price currency }
        categories { name }
        usedInTasks { name }
      }
    }
  `;

  const response = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { lang } }),
  });

  const { data } = await response.json();
  return data.items;
}
