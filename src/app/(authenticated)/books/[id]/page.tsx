import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { BookDetailClient } from "@/components/features/books/book-detail-client";
import { PageContainer } from "@/components/layout/page-container";
import { auth } from "@/lib/auth/server";
import { createBookService } from "@/lib/factories/book";

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

  const detail = await createBookService().findByIdForUser(id, session.user.id);
  if (!detail) {
    notFound();
  }

  return (
    <PageContainer>
      <BookDetailClient book={detail} />
    </PageContainer>
  );
}
