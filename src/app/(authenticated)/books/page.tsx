import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BooksClient } from "@/components/features/books/books-client";
import { PageContainer } from "@/components/layout/page-container";
import { auth } from "@/lib/auth/server";
import { createBookService } from "@/lib/factories/book";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/auth/sign-in");
  }

  const service = createBookService();
  const books = await service.listForUser(session.user.id);

  return (
    <PageContainer>
      <BooksClient initialBooks={books} />
    </PageContainer>
  );
}
