---
name: nativewind-styling
description: Use when building UI components, layouts, or applying brand styles.
---
# NativeWind Styling Skill (v4)

## 🎨 Brand Tokens (Reference `tailwind.config.js`)
- **Primary:** `bg-primary-500` (#3b82f6), `text-primary-600`.
- **QUB Red:** `text-qub-red` (#D6001C), `bg-qub-red`.
- **UU Teal:** `text-uu-teal` (#00A3A0), `bg-uu-teal`.
- **Surfaces:** `bg-surface` (Dark Background), `bg-surface-card` (Lighter Gray), `border-surface-border`.

## 📏 Layout Standards
- **Flexbox Only:** Never use `grid`. React Native only supports Flexbox.
- **Safe Areas:** Always use `SafeAreaView` from `react-native-safe-area-context` for root screens.
- **Spacing:** Use standard Tailwind spacing (e.g., `p-4`, `m-2`, `gap-4`).
- **Sizing:** Use `w-full`, `h-screen`, or specific values like `w-10`.

## 📱 React Native Specifics
- **Text Styling:** All text must be inside a `<Text>` component. Use `text-base`, `font-bold`, etc.
- **Platform Prefixes:** Use `ios:` and `android:` for platform-specific tweaks.
- **Dark Mode:** The app is dark-mode first. Use `dark:text-white` or stick to the `bg-surface` tokens.
- **Icons:** Style Lucide icons using the `color` and `size` props, or pass `className` if configured.

## 🚫 Restricted Classes (Do Not Use)
- No `cursor-pointer` (use `Pressable` or `TouchableOpacity`).
- No `hover:` (use `active:` or `pressed:` states).
- No `fixed` or `sticky` positioning (use absolute positioning or sticky headers in ScrollViews).

## 💡 Best Practices
1. When building a card, use `bg-surface-card rounded-2xl p-4 border border-surface-border`.
2. For the "Student-Cool" look, use high-contrast text against dark backgrounds with subtle borders.