import type { Metadata } from "next";
import { baseMetadata, canonical } from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return baseMetadata({
    title: "Post",
    description: "See this movie post and discussion on Canisterr.",
    alternates: { canonical: canonical(`/posts/${id}`) },
  });
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
