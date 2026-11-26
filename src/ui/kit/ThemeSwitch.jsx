// Cambio de tema (claro, oscuro o el del sistema), el mismo en el catálogo,
// Negocio y el portal. useTheme de HeroUI guarda la elección en «heroui-theme»
// y pone data-theme en <html>; el script del <head> de cada página la aplica
// antes del primer pintado para que no parpadee.
import { Display, Moon, Sun } from '@gravity-ui/icons';
import { ToggleButton, ToggleButtonGroup, Tooltip, useTheme } from '@heroui/react';

const OPTIONS = [
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'dark', label: 'Oscuro', Icon: Moon },
  { id: 'system', label: 'Como el sistema', Icon: Display },
];

export function ThemeSwitch({ size = 'sm' }) {
  const { theme, setTheme } = useTheme('system');
  return (
    <ToggleButtonGroup
      aria-label="Tema"
      selectionMode="single"
      disallowEmptySelection
      size={size}
      selectedKeys={new Set([theme])}
      onSelectionChange={(keys) => {
        const [next] = keys;
        if (next) setTheme(String(next));
      }}
    >
      {OPTIONS.map(({ id, label, Icon }, i) => (
        <Tooltip key={id} delay={300}>
          <ToggleButton id={id} isIconOnly aria-label={label}>
            {i > 0 && <ToggleButtonGroup.Separator />}
            <Icon />
          </ToggleButton>
          <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
