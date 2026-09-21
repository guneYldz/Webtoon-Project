import { permanentRedirect } from "next/navigation";

export default function LegacyNovelChapterPage({ params }) {
  permanentRedirect(`/novel/${params.slug}/bolum/${params.chapterNumber}`);
}
