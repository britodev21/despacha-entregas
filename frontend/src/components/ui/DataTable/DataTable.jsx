import { cx } from "@/lib/cx";

import { Skeleton } from "../Skeleton/Skeleton";
import styles from "./DataTable.module.css";

/**
 * Tabela de dados responsiva.
 * Desktop: tabela clássica. Celular: cada linha vira um cartão, com o nome
 * da coluna ao lado do valor (via data-label + CSS, sem duplicar marcação).
 *
 * columns: [{ key, header, render(row), className, primary }]
 *   primary: coluna de destaque no cartão (sem rótulo, ocupa a linha toda)
 */
export function DataTable({
  columns,
  rows,
  rowKey = "id",
  loading = false,
  caption,
  skeletonRows = 4,
}) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={loading || undefined}>
          {loading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                <tr key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key} data-label={column.header} className={column.className}>
                      <Skeleton width={column.primary ? "70%" : "50%"} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={row[rowKey]}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      data-label={column.header}
                      className={cx(column.className, column.primary && styles.primary)}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
