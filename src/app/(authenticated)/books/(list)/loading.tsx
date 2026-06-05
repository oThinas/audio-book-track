import { PageContainer } from "@/components/layout/page-container";
import { ListPageLoading } from "@/components/layout/page-loading";

export default function BooksLoading() {
  return (
    <PageContainer>
      <ListPageLoading
        title="Livros"
        description="Acompanhe capítulos, ganhos e status por livro."
        actionLabel="Novo Livro"
        searchPlaceholder="Buscar por título ou estúdio"
        searchLabel="Buscar livros"
      />
    </PageContainer>
  );
}
