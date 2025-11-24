# Digital Menu - AI Image Generation Prompt

## Current Digital Menu Structure

### Layout Overview
The digital menu is a full-screen kiosk interface divided into two main sections:

**Left Panel (25% width):**
- Massage list with scrollable cards
- Featured massages section (highlighted)
- Regular massages section

**Right Panel (75% width):**
- Top half: Media display (video/photo)
- Bottom half: Detailed information

---

## Dynamic Elements & Data Fields

### 1. Massage Card (Left Panel)
Each massage in the list contains:

- **Massage Name** (string)
  - Example: "Swedish Massage", "Deep Tissue Massage", "Hot Stone Therapy"
  - Font: Large, bold, white text
  - Position: Top of card

- **Short Description** (string, 2-line clamp)
  - Example: "Relaxing full-body massage using gentle strokes to ease tension"
  - Font: Small, gray text
  - Position: Below name

- **Purpose Tags** (array of strings)
  - Example: ["Relaxation", "Stress Relief", "Pain Management"]
  - Display: Small chips/badges with gray background
  - Position: Bottom of card

- **Featured Badge** (boolean)
  - Featured massages have yellow/gold accent
  - Regular massages have standard styling

- **Selection State** (boolean)
  - Selected: Blue background with shadow
  - Unselected: Dark gray background

---

### 2. Detail Panel - Header Section (Right Panel Top)

- **Massage Name** (string)
  - Example: "Swedish Massage"
  - Font: Extra large (4xl), bold, white
  - Position: Top of details section

- **Duration** (string, optional)
  - Example: "60 minutes", "90 minutes"
  - Display: Icon + text, gray color
  - Position: Below name

- **Purpose Tags** (array of strings)
  - Example: ["Relaxation", "Stress Relief", "Muscle Recovery"]
  - Display: Larger chips/badges with blue background
  - Position: Below duration

---

### 3. Detail Panel - Description Section

- **Long Description** (string, multi-paragraph)
  - Example: "Experience the ultimate relaxation with our signature Swedish massage. This therapeutic treatment uses long, flowing strokes combined with gentle kneading to release muscle tension, improve circulation, and promote deep relaxation. Perfect for those seeking stress relief and overall wellness."
  - Font: Large (lg), light gray, good line spacing
  - Position: Middle of details section

---

### 4. Detail Panel - Pricing Section

- **Section Title** (translated string)
  - Text: "Pricing" or "Fiyatlandırma" (Turkish)
  - Font: Large (2xl), semibold, white
  - Position: Above pricing cards

- **Session Cards** (array of objects)
  Each session contains:
  - **Session Name** (string)
    - Example: "30 Minutes", "60 Minutes", "90 Minutes"
    - Font: Large, light gray
    - Position: Left side of card
  
  - **Price** (number, formatted as currency)
    - Example: "750 TL", "1.000 TL", "1.500 TL"
    - Font: Extra large (xl), bold, white
    - Position: Right side of card
  
  - **Card Styling**
    - Background: Dark gray (gray-800)
    - Padding: Generous spacing
    - Border radius: Rounded corners
    - Layout: Flexbox with space-between

---

### 5. Media Section (Right Panel Top Half)

- **Media Type** (enum: 'video' | 'photo')
  
  **If Video:**
  - Autoplay, muted, looping
  - Full width and height
  - Object-fit: cover
  - Controls: Hidden
  
  **If Photo:**
  - Full width and height
  - Object-fit: contain
  - High resolution display
  
  **If No Media/Error:**
  - Placeholder with icon
  - Gray background
  - "Media Unavailable" message

- **Media URL** (string)
  - Example: "/uploads/videos/swedish-massage.mp4"
  - Example: "/uploads/photos/hot-stone-therapy.jpg"

---

### 6. Additional UI Elements

**Loading State:**
- Spinning loader animation
- "Loading..." text in gray
- Centered on screen

**Empty State:**
- Icon (sad face)
- "No massages available" message
- Centered on screen

**Slideshow Mode:**
- Auto-activates after 60 seconds of inactivity
- Full-screen carousel of all massages
- Touch to exit

---

## Color Scheme

### Background Colors
- Main background: `#030712` (gray-950)
- Left panel: `#111827` (gray-900)
- Cards: `#1F2937` (gray-800)
- Selected card: `#2563EB` (blue-600)

### Text Colors
- Primary text: `#FFFFFF` (white)
- Secondary text: `#D1D5DB` (gray-300)
- Tertiary text: `#9CA3AF` (gray-400)
- Disabled text: `#6B7280` (gray-500)

### Accent Colors
- Featured badge: `#FBBF24` (yellow-400)
- Purpose tags: `#2563EB` (blue-600)
- Hover state: `#374151` (gray-700)

---

## Typography

### Font Sizes
- Extra large heading: 36px (4xl)
- Large heading: 30px (2xl)
- Medium heading: 24px (xl)
- Body large: 18px (lg)
- Body medium: 16px (base)
- Small text: 14px (sm)
- Extra small: 12px (xs)

### Font Weights
- Bold: 700
- Semibold: 600
- Medium: 500
- Regular: 400

---

## Spacing & Layout

### Padding
- Large sections: 32px (8)
- Medium sections: 16px (4)
- Small sections: 12px (3)
- Cards: 16px (4)

### Gaps
- Between cards: 12px (3)
- Between sections: 24px (6)
- Between elements: 8px (2)

### Border Radius
- Cards: 8px (lg)
- Chips/badges: 9999px (full)

---

## Sample Data Structure

```json
{
  "id": "massage-001",
  "name": "Swedish Massage",
  "shortDescription": "Relaxing full-body massage using gentle strokes",
  "longDescription": "Experience the ultimate relaxation with our signature Swedish massage. This therapeutic treatment uses long, flowing strokes combined with gentle kneading to release muscle tension, improve circulation, and promote deep relaxation.",
  "duration": "60 minutes",
  "mediaType": "video",
  "mediaUrl": "/uploads/videos/swedish-massage.mp4",
  "purposeTags": ["Relaxation", "Stress Relief", "Circulation"],
  "sessions": [
    { "name": "30 Minutes", "price": 750 },
    { "name": "60 Minutes", "price": 1000 },
    { "name": "90 Minutes", "price": 1500 }
  ],
  "isFeatured": true,
  "sortOrder": 1
}
```

---

## AI Image Generation Prompt

### Main Prompt

```
Create a modern, luxurious spa digital menu interface for a kiosk touchscreen display. 

LAYOUT:
- Split screen design: 25% left sidebar, 75% right content area
- Dark, elegant color scheme with deep blacks (#030712) and dark grays (#111827)
- Left sidebar contains a vertical scrollable list of massage service cards
- Right area split horizontally: top 50% for media, bottom 50% for details

LEFT SIDEBAR DESIGN:
- Featured section at top with gold/yellow accent (#FBBF24)
- Each massage card shows:
  * Bold white service name (e.g., "Swedish Massage")
  * Gray subtitle description (2 lines max)
  * Small rounded tag chips at bottom (e.g., "Relaxation", "Stress Relief")
- Selected card has bright blue background (#2563EB) with subtle shadow
- Unselected cards have dark gray background (#1F2937)
- Smooth hover effects

RIGHT PANEL - TOP HALF (MEDIA):
- Full-width video player or high-quality photo
- Showing serene spa environment: massage stones, candles, peaceful setting
- Professional spa photography aesthetic
- Subtle gradient overlay at bottom edge

RIGHT PANEL - BOTTOM HALF (DETAILS):
- Large bold white heading: "Swedish Massage"
- Clock icon + duration text: "60 minutes" in gray
- Blue rounded tag chips: "Relaxation", "Stress Relief", "Muscle Recovery"
- Multi-paragraph description in light gray with excellent readability
- "Pricing" section header in white
- Three pricing cards with dark gray background:
  * Left: "30 Minutes" in gray
  * Right: "750 TL" in bold white
  * Rounded corners, generous padding

VISUAL STYLE:
- Ultra-modern, minimalist spa aesthetic
- High contrast for readability from distance
- Soft shadows and subtle gradients
- Professional spa photography
- Calming, luxurious atmosphere
- Touch-friendly large buttons and cards
- Smooth transitions and animations implied

COLOR PALETTE:
- Background: Deep black (#030712)
- Sidebar: Dark gray (#111827)
- Cards: Medium gray (#1F2937)
- Accent: Bright blue (#2563EB)
- Featured: Gold yellow (#FBBF24)
- Text: Pure white (#FFFFFF) and light gray (#D1D5DB)

TYPOGRAPHY:
- Large, bold, sans-serif fonts
- Excellent hierarchy and spacing
- High contrast for accessibility
- Professional spa branding feel

MOOD:
- Luxurious and calming
- Professional and trustworthy
- Modern and tech-forward
- Inviting and relaxing
- High-end spa experience

TECHNICAL REQUIREMENTS:
- Kiosk touchscreen optimized
- 1920x1080 resolution
- Landscape orientation
- Touch-friendly UI elements (minimum 44px touch targets)
- Clear visual hierarchy
- Accessible color contrast ratios

EXAMPLE SERVICES TO SHOW:
1. Swedish Massage (Featured, selected with blue background)
2. Deep Tissue Massage (Featured)
3. Hot Stone Therapy (Regular)
4. Aromatherapy Massage (Regular)

Show the Swedish Massage as selected with full details visible on the right panel, including a serene spa video/photo in the media section and complete pricing information.
```

---

### Alternative Prompt (Simplified)

```
Design a luxury spa kiosk menu interface with dark theme. 

Left side (25%): Vertical list of massage cards with names, descriptions, and tag chips. Featured items have gold accent. Selected card is blue.

Right side (75%): Top half shows spa video/photo. Bottom half shows massage details: large title, duration, tags, description, and pricing cards with session durations and prices in Turkish Lira.

Colors: Black background (#030712), dark gray cards (#1F2937), blue accent (#2563EB), white text. Modern, minimalist, luxurious spa aesthetic. Touch-friendly design for kiosk display.
```

---

### Prompt for Specific Elements

#### Massage Card Design
```
Design a massage service card for a spa kiosk menu. Dark gray background (#1F2937), rounded corners. Contains: bold white title "Swedish Massage", gray subtitle "Relaxing full-body massage using gentle strokes", and three small rounded tag chips at bottom labeled "Relaxation", "Stress Relief", "Circulation". Modern, minimalist, touch-friendly design. 300x200px card size.
```

#### Pricing Section Design
```
Design a pricing section for spa services. Dark background with "Pricing" header in white. Three pricing cards below: each card has dark gray background (#1F2937), rounded corners, shows session duration on left ("30 Minutes") and price on right ("750 TL") in bold white. Cards stacked vertically with spacing. Modern, clean, luxurious aesthetic.
```

#### Media Section Design
```
Design a spa media display section showing a serene massage environment. High-quality photo of hot stones, candles, and peaceful spa setting. Cinematic 16:9 aspect ratio. Professional spa photography with warm, calming tones. Subtle gradient overlay at bottom. Ultra-modern, luxurious aesthetic.
```

---

## Usage Instructions

### For AI Image Generators (Midjourney, DALL-E, Stable Diffusion)

1. **Use the Main Prompt** for complete interface design
2. **Add specific parameters:**
   - Aspect ratio: `--ar 16:9` or `1920:1080`
   - Style: `--style modern minimalist luxury spa`
   - Quality: `--quality 2` or `--hd`

3. **Example Midjourney command:**
```
/imagine [Main Prompt] --ar 16:9 --style modern minimalist --quality 2 --v 6
```

4. **Example DALL-E prompt:**
```
[Main Prompt] Ultra-realistic, professional UI design, 4K quality, modern spa aesthetic
```

### For UI Design Tools (Figma AI, Uizard)

1. Use the **Sample Data Structure** to populate fields
2. Reference the **Color Scheme** and **Typography** sections
3. Follow the **Spacing & Layout** guidelines
4. Import the generated image as reference

### For Redesign Iterations

1. Start with **Main Prompt** for overall layout
2. Use **Element-Specific Prompts** for detailed sections
3. Combine results in design tool
4. Adjust colors using the **Color Palette** section

---

## Expected Output

The AI should generate a photorealistic mockup of a spa kiosk digital menu interface showing:

✅ Dark, luxurious aesthetic
✅ Clear two-panel layout (25/75 split)
✅ Massage list with featured items
✅ Selected massage with blue highlight
✅ Media section with spa imagery
✅ Detailed information section
✅ Pricing cards with Turkish Lira
✅ Professional typography and spacing
✅ Touch-friendly UI elements
✅ High contrast for readability
✅ Modern, minimalist design

---

## Notes

- All text content is **dynamic** and comes from database
- Media (videos/photos) are **uploaded** by admin
- Prices are **configurable** per massage service
- Purpose tags are **customizable** arrays
- Interface supports **Turkish language** (RTL not required)
- Design must work on **Raspberry Pi 4** hardware
- Optimized for **touchscreen interaction**
- Auto-transitions to **slideshow mode** after 60 seconds

---

**Created:** November 24, 2025
**Purpose:** AI-assisted redesign of spa digital menu interface
**Target:** Kiosk touchscreen display (1920x1080)
**Style:** Modern luxury spa aesthetic
