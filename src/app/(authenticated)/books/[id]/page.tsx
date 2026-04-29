import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { BookDetailClient } from "@/components/features/books/book-detail-client";
import { PageContainer } from "@/components/layout/page-container";
import { auth } from "@/lib/auth/server";
import { createBookService } from "@/lib/factories/book";
import { createEditorService } from "@/lib/factories/editor";
import { createNarratorService } from "@/lib/factories/narrator";
import { createStudioService } from "@/lib/factories/studio";

export const dynamic = "force-dynamic";

interface BookDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/auth/sign-in");
  }

  const [detail, narrators, editors, studios] = await Promise.all([
    createBookService().findById(id),
    createNarratorService().list(),
    createEditorService().list(),
    createStudioService().list(),
  ]);
  if (!detail) {
    notFound();
  }

  return (
    <PageContainer>
      <BookDetailClient
        book={detail}
        narrators={narrators.map((n) => ({ id: n.id, name: n.name }))}
        editors={editors.map((e) => ({ id: e.id, name: e.name }))}
        studios={studios}
      />
    </PageContainer>
  );
}
