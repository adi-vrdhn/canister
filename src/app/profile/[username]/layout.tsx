import type { Metadata } from "next";
import { profileMetadata, breadcrumbSchema, BASE_URL } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

type Props = {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return profileMetadata(username);
}

export default async function ProfileLayout({ params, children }: Props) {
  const { username } = await params;

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: BASE_URL },
          { name: `@${username}`, url: `${BASE_URL}/profile/${username}` },
        ])}
      />
      {children}
    </>
  );
}
