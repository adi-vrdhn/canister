// Injects a JSON-LD <script> block into the page <head>.
// Use inside server layouts or server pages — never in client components.
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
