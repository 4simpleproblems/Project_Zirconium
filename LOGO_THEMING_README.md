# Logo Theming Feature

## Overview

The navigation.js file now supports dynamic logo theming, allowing the logo to change both its source image and color tint based on the selected theme. This feature reads theme configurations from `themes.json` and applies them automatically.

## How It Works

### Logo Source Switching
- Each theme can specify a `logo-src` property to use a different logo image
- Common patterns:
  - Dark themes: `/images/logo.png` (light logo on dark background)
  - Light themes: `/images/logo-dark.png` (dark logo on light background)

### Logo Color Tinting
- Themes can include a `logo-tint-color` property with a hex color code
- The system applies CSS filters to tint the logo to match the theme's color scheme
- Uses advanced color conversion (RGB → HSL) for accurate color reproduction

## Theme Configuration

### Basic Theme Structure
```json
{
    "name": "Theme Name",
    "logo-src": "/images/logo.png",
    "logo-tint-color": "#ff0000",
    "navbar-bg": "#000000",
    // ... other theme properties
}
```

### Properties

#### `logo-src` (optional)
- **Type**: String (URL path)
- **Description**: Path to the logo image file
- **Default**: Uses the default theme's logo-src
- **Examples**:
  - `"/images/logo.png"` - Standard light logo
  - `"/images/logo-dark.png"` - Dark logo for light themes

#### `logo-tint-color` (optional)
- **Type**: String (hex color)
- **Description**: Hex color code to tint the logo
- **Format**: `#RRGGBB` (with or without #)
- **Examples**:
  - `"#00ff00"` - Matrix green
  - `"#64ffda"` - Cyan blue
  - `"#d2a6ff"` - Purple

## Implementation Details

### CSS Filter Generation
The system converts hex colors to CSS filters using:
1. **RGB Conversion**: Hex → RGB values
2. **HSL Conversion**: RGB → Hue, Saturation, Lightness
3. **Filter Creation**: Generates `hue-rotate()`, `saturate()`, and `brightness()` filters

### Filter Application Process
```css
/* Step 1: Make logo black */
filter: brightness(0) saturate(100%)

/* Step 2: Apply color transformation */
filter: brightness(0) saturate(100%) hue-rotate(120deg) saturate(200%) brightness(50%)
```

## Usage Examples

### Example 1: Matrix Theme
```json
{
    "name": "Matrix",
    "logo-src": "/images/logo.png",
    "logo-tint-color": "#00ff00",
    "navbar-bg": "#020a04"
}
```
Result: Standard logo tinted bright green

### Example 2: Light Theme
```json
{
    "name": "Light",
    "logo-src": "/images/logo-dark.png",
    "navbar-bg": "#ffffff"
}
```
Result: Dark logo with no tinting (suitable for light background)

### Example 3: Royal Theme
```json
{
    "name": "Royal",
    "logo-src": "/images/logo.png",
    "logo-tint-color": "#d2a6ff",
    "navbar-bg": "#1a0033"
}
```
Result: Standard logo tinted purple

## Testing

### Manual Testing
1. Open `test-logo-theming.html` in a browser
2. Click theme buttons to see logo changes
3. Verify both source switching and color tinting

### Programmatic Testing
```javascript
// Test color conversion
node test-color-functions.js

// Test theme application
window.applyTheme({
    "name": "Test",
    "logo-src": "/images/logo.png",
    "logo-tint-color": "#ff0000"
});
```

## Browser Compatibility

- **CSS Filters**: Supported in all modern browsers
- **Hue Rotation**: IE 10+, all modern browsers
- **Saturation/Brightness**: IE 10+, all modern browsers

## Performance Considerations

- Logo changes are applied instantly via CSS
- No additional HTTP requests for color tinting
- Minimal computational overhead for color conversion
- Filters are hardware-accelerated in modern browsers

## Troubleshooting

### Logo Not Changing Color
1. Check that `logo-tint-color` is a valid hex color
2. Verify the logo element has ID `navbar-logo`
3. Ensure the theme object is properly formatted

### Logo Not Switching Source
1. Verify `logo-src` path is correct and accessible
2. Check browser network tab for 404 errors
3. Ensure logo element exists when theme is applied

### Performance Issues
1. Avoid applying themes too frequently
2. Use `requestAnimationFrame` for smooth transitions
3. Consider preloading logo images for faster switching
