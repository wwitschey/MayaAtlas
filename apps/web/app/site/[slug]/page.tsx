export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main style={{ padding: 24 }}>
      <h1>Site: {slug}</h1>
      <p>Site detail page placeholder.</p>
    </main>
  );
}
