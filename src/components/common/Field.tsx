import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/helpers";

const control =
  "w-full rounded-md border border-line bg-surface-raised px-3.5 py-2.5 font-ui text-sm text-foreground placeholder:text-subtle transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger";

interface FieldProps {
  label: string;
  name: string;
  error?: string | string[];
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string; className: string }) => ReactNode;
}

/** Label + control + inline error, wired up for screen readers. */
export function Field({ label, name, error, hint, className, children }: FieldProps) {
  const id = `field-${name}`;
  const message = Array.isArray(error) ? error[0] : error;
  const describedBy = message ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5 font-ui", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
        {label}
      </label>
      {children({ id, "aria-invalid": message ? true : undefined, "aria-describedby": describedBy, className: control })}
      {message ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {message}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-caption text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type InputProps = Omit<ComponentProps<"input">, "name"> & { label: string; name: string; error?: string | string[]; hint?: ReactNode; fieldClassName?: string };

export function Input({ label, name, error, hint, fieldClassName, className, ...rest }: InputProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={fieldClassName}>
      {(p) => <input name={name} {...p} {...rest} className={cn(p.className, className)} />}
    </Field>
  );
}

type SelectProps = Omit<ComponentProps<"select">, "name"> & { label: string; name: string; error?: string | string[]; hint?: ReactNode; fieldClassName?: string };

export function Select({ label, name, error, hint, fieldClassName, className, children, ...rest }: SelectProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={fieldClassName}>
      {(p) => (
        <select name={name} {...p} {...rest} className={cn(p.className, "pr-8", className)}>
          {children}
        </select>
      )}
    </Field>
  );
}

type TextareaProps = Omit<ComponentProps<"textarea">, "name"> & { label: string; name: string; error?: string | string[]; hint?: ReactNode; fieldClassName?: string };

export function Textarea({ label, name, error, hint, fieldClassName, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={fieldClassName}>
      {(p) => <textarea name={name} rows={3} {...p} {...rest} className={cn(p.className, "resize-y", className)} />}
    </Field>
  );
}

export function Checkbox({ label, description, ...rest }: ComponentProps<"input"> & { label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 font-ui text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" {...rest} />
      <span>
        <span className="font-medium">{label}</span>
        {description && <span className="block text-muted">{description}</span>}
      </span>
    </label>
  );
}
