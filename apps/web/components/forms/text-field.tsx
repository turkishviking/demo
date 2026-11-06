import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type TextFieldProps = { label: string; name: string } & Omit<
  React.ComponentProps<'input'>,
  'name' | 'id'
>;

/** Champ avec son label associé (accessibilité : `htmlFor` / `id`). */
export function TextField({ label, name, ...props }: TextFieldProps) {
  const id = `field-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
    </div>
  );
}
