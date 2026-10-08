/** Tiny message helpers shared by server and client. */

/** Replace {placeholders}: fmt("Ciao {name}", { name: "Ana" }). */
export function fmt(message: string, vars: Record<string, string | number> = {}): string {
  return message.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}

export interface Plural {
  one: string;
  other: string;
}

/** plural(3, { one: "{n} persona", other: "{n} persone" }) → "3 persone". */
export function plural(n: number, forms: Plural): string {
  return fmt(n === 1 ? forms.one : forms.other, { n });
}
