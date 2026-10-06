import { Compass } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";

import styles from "./CenteredPage.module.css";

export function NotFoundPage() {
  return (
    <main className={styles.centered}>
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description="O endereço pode estar errado ou a página foi movida."
        actions={
          <Button as={Link} to="/">
            Voltar ao início
          </Button>
        }
      />
    </main>
  );
}
