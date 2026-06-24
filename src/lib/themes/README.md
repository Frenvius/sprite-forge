# Theme System

The theme system allows you to customize the application's color scheme using JSON-based theme files.

## Theme Structure

A theme is a JSON object with the following structure:

```json
{
  "name": "theme-name",
  "displayName": "Theme Display Name",
  "colors": {
    "light": {
      "background": "216 20% 8%",
      "foreground": "0 0% 92%",
      "primary": "217 91% 60%",
      ...
    },
    "dark": {
      "background": "220 15% 12%",
      "foreground": "0 0% 95%",
      "primary": "217 91% 60%",
      ...
    }
  }
}
```

All color values are in HSL format: `"hue saturation% lightness%"` (without the `hsl()` wrapper).

## Available Color Properties

- `background` - Main background color
- `foreground` - Main text color
- `card` - Card background
- `card-foreground` - Card text color
- `popover` - Popover background
- `popover-foreground` - Popover text color
- `primary` - Primary accent color
- `primary-foreground` - Primary text color
- `secondary` - Secondary color
- `secondary-foreground` - Secondary text color
- `muted` - Muted background
- `muted-foreground` - Muted text color
- `accent` - Accent color (for hovers, selections)
- `accent-foreground` - Accent text color
- `destructive` - Error/destructive action color
- `destructive-foreground` - Destructive text color
- `border` - Border color
- `input` - Input background
- `ring` - Focus ring color
- `panel-bg` - Panel background
- `panel-border` - Panel border
- `item-hover` - Item hover state
- `item-selected` - Selected item color
- `toolbar-bg` - Toolbar background
- `sidebar-*` - Sidebar-specific colors

## Default Themes

The system includes several built-in themes:

1. **Default** - Blue primary with grayish accent
2. **Ocean** - Cyan/teal color scheme
3. **Forest** - Green color scheme
4. **Sunset** - Orange/amber color scheme
5. **Purple** - Purple/violet color scheme

## Usage

### Using the Theme Hook

```tsx
import { useTheme } from '~/lib/themes';

function MyComponent() {
  const { 
    currentTheme, 
    themes, 
    isDark, 
    setThemeByName, 
    toggleDarkMode,
    exportCurrentTheme,
    importThemeFromJson 
  } = useTheme();

  return (
    <div>
      <button onClick={() => setThemeByName('ocean')}>
        Switch to Ocean Theme
      </button>
      <button onClick={toggleDarkMode}>
        Toggle Dark Mode
      </button>
      <button onClick={() => {
        const json = exportCurrentTheme();
        console.log(json);
      }}>
        Export Theme
      </button>
    </div>
  );
}
```

### Exporting a Theme

```tsx
const { exportCurrentTheme } = useTheme();
const themeJson = exportCurrentTheme();
// Save to file or copy to clipboard
```

### Importing a Theme

```tsx
const { importThemeFromJson } = useTheme();

try {
  const themeJson = `{ "name": "custom", ... }`;
  importThemeFromJson(themeJson);
} catch (error) {
  console.error('Invalid theme format');
}
```

### Creating a Custom Theme

1. Copy an existing theme from `src/lib/themes/themes.json`
2. Modify the color values (HSL format)
3. Update the `name` and `displayName`
4. Add it to the themes array or import it dynamically

## Theme Persistence

Themes are automatically saved to localStorage:
- Theme name: `sprite-forge-theme`
- Dark mode preference: `sprite-forge-dark-mode`

The selected theme and dark mode preference persist across application restarts.










