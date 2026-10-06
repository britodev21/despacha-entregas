/** Junta classes CSS ignorando valores falsos: cx("a", cond && "b") */
export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
