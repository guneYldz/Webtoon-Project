export default async function sitemap() {
  // Tüm romanları çek
  const novels = await fetch('http://127.0.0.1:8000/novels/').then((res) => res.json());

  const novelUrls = novels.map((novel) => ({
    url: `https://seninsiten.com/novel/${novel.slug}`,
    lastModified: new Date(novel.created_at || Date.now()),
  }));

  return [
    {
      url: 'https://seninsiten.com',
      lastModified: new Date(),
    },
    ...novelUrls,
  ];
}